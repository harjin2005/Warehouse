import uuid

from sqlalchemy import text

from app.db import tenant_scoped_session, get_session_factory
import app.db as app_db


async def _make_user(raw_session, tenant_id, email):
    from app.models.user import User

    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        email=email,
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=True,
        role="member",
    )
    raw_session.add(user)
    await raw_session.commit()
    return user.id


async def test_tenant_scoped_session_only_sees_own_tenant_rows(
    db_engine, raw_session, tenant_a_id, tenant_b_id, monkeypatch
):
    await _make_user(raw_session, tenant_a_id, "a@tenanta.com")
    await _make_user(raw_session, tenant_b_id, "b@tenantb.com")

    monkeypatch.setattr(app_db, "_engine", db_engine)
    monkeypatch.setattr(app_db, "_session_factory", None)

    from app.models.user import User
    from sqlalchemy import select

    async with tenant_scoped_session(tenant_a_id) as session:
        result = await session.execute(select(User))
        emails = {u.email for u in result.scalars().all()}
        assert emails == {"a@tenanta.com"}

    async with tenant_scoped_session(tenant_b_id) as session:
        result = await session.execute(select(User))
        emails = {u.email for u in result.scalars().all()}
        assert emails == {"b@tenantb.com"}


async def test_session_without_tenant_id_set_sees_no_rows(
    db_engine, raw_session, tenant_a_id
):
    await _make_user(raw_session, tenant_a_id, "c@tenanta.com")

    from app.models.user import User
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        async with session.begin():
            result = await session.execute(select(User))
            assert result.scalars().all() == []
