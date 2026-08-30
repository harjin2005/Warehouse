import uuid

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


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
