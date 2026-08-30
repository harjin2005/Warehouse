import uuid

import pytest
from httpx import AsyncClient, ASGITransport
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlalchemy import select

from app.main import app
from app.models.user import User


@pytest.fixture
def tenant_ids(tenant_a_id, tenant_b_id):
    return {"a": tenant_a_id, "b": tenant_b_id}


async def _register_and_login(client: AsyncClient, tenant_id: uuid.UUID, email: str):
    register_resp = await client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "correct-horse-battery-staple",
            "tenant_id": str(tenant_id),
        },
    )
    assert register_resp.status_code == 201, register_resp.text

    login_resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": "correct-horse-battery-staple"},
    )
    assert login_resp.status_code == 200, login_resp.text
    return login_resp.json()["access_token"]


async def test_user_can_register_login_and_see_only_their_own_tenant(
    run_migrations, tenant_ids
):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token_a = await _register_and_login(client, tenant_ids["a"], "user@a.com")
        token_b = await _register_and_login(client, tenant_ids["b"], "user@b.com")

        resp_a = await client.get(
            "/me/tenant", headers={"Authorization": f"Bearer {token_a}"}
        )
        assert resp_a.status_code == 200
        assert resp_a.json()["tenant_id"] == str(tenant_ids["a"])

        resp_b = await client.get(
            "/me/tenant", headers={"Authorization": f"Bearer {token_b}"}
        )
        assert resp_b.status_code == 200
        assert resp_b.json()["tenant_id"] == str(tenant_ids["b"])


async def test_duplicate_email_registration_rejected(run_migrations, tenant_ids):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client, tenant_ids["a"], "dup@a.com")
        second = await client.post(
            "/auth/register",
            json={
                "email": "dup@a.com",
                "password": "another-password-1",
                "tenant_id": str(tenant_ids["b"]),
            },
        )
        assert second.status_code == 400


async def test_registration_role_field_cannot_be_self_escalated(run_migrations, tenant_ids):
    """An anonymous /auth/register caller must not be able to set their own
    `role` via the request body.

    `UserManager.create()` (safe=True path) forces `role` to "member"
    regardless of what the payload contains -- see the comment in
    app/auth/manager.py's create(). Before that fix, fastapi-users'
    `create_update_dict()` (used whenever `safe=True`) did not strip this
    app's custom `role` field, so `{"role": "admin", ...}` in the register
    payload would have been written straight into `users.role` unfiltered.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        register_resp = await client.post(
            "/auth/register",
            json={
                "email": "escalate@a.com",
                "password": "correct-horse-battery-staple",
                "tenant_id": str(tenant_ids["a"]),
                "role": "admin",
            },
        )
        assert register_resp.status_code == 201, register_resp.text

        login_resp = await client.post(
            "/auth/jwt/login",
            data={
                "username": "escalate@a.com",
                "password": "correct-horse-battery-staple",
            },
        )
        assert login_resp.status_code == 200, login_resp.text
        token = login_resp.json()["access_token"]

        me_resp = await client.get(
            "/me/tenant", headers={"Authorization": f"Bearer {token}"}
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["role"] == "member"


async def test_login_rehashes_outdated_password_hash(
    run_migrations, tenant_a_id, raw_session
):
    """`UserManager.authenticate()`'s rehash-and-persist branch must not
    crash, and must actually persist the upgraded hash.

    This constructs a genuine rehash-triggering case (rather than asserting
    against a mock) by inserting a user row whose stored hash was produced
    by `BcryptHasher` directly -- a real, valid hash, but not the
    `PasswordHelper`'s preferred scheme (Argon2, first in its hasher list;
    see fastapi_users.password.PasswordHelper and pwdlib's
    PasswordHash.verify_and_update, which rehashes whenever the hash that
    verified isn't produced by `current_hasher`). Logging in with the
    correct plaintext password must both succeed and cause the stored hash
    to be upgraded to Argon2 -- proving the rehash branch ran through
    `tenant_scoped_session` (see app/auth/manager.py) instead of crashing
    on the inherited `self.user_db.update()` call (`self.user_db` is
    `None` in this codebase).
    """
    plaintext = "correct-horse-battery-staple"
    bcrypt_hash = BcryptHasher().hash(plaintext)
    assert bcrypt_hash.startswith("$2b$")

    legacy_user = User(
        email="legacy@a.com",
        hashed_password=bcrypt_hash,
        tenant_id=tenant_a_id,
        role="member",
        is_active=True,
        is_verified=True,
        is_superuser=False,
    )
    raw_session.add(legacy_user)
    await raw_session.commit()
    user_id = legacy_user.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post(
            "/auth/jwt/login",
            data={"username": "legacy@a.com", "password": plaintext},
        )
        assert login_resp.status_code == 200, login_resp.text

    # Force a fresh read from the DB (expire_on_commit=False on this
    # session's factory would otherwise return the cached, pre-login
    # object) to prove the update the login request made was actually
    # persisted, not just returned in-memory.
    raw_session.expire_all()
    result = await raw_session.execute(select(User).where(User.id == user_id))
    refreshed = result.scalar_one()
    assert not refreshed.hashed_password.startswith("$2b$")
    assert refreshed.hashed_password != bcrypt_hash
