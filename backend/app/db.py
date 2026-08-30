from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


@asynccontextmanager
async def tenant_scoped_session(
    tenant_id: uuid.UUID,
) -> AsyncIterator[AsyncSession]:
    """Yield a session whose transaction has app.tenant_id set for RLS.

    Every query issued through this session sees only rows belonging to
    tenant_id, enforced by Postgres RLS policies -- not by application code
    remembering a WHERE clause.
    """
    factory = get_session_factory()
    async with factory() as session:
        async with session.begin():
            # SET LOCAL does not accept bind parameters over the asyncpg
            # extended query protocol ("syntax error at or near $1"), so we
            # use the set_config() function instead, which is a normal SQL
            # function call and does support bind parameters. The third
            # argument (true) makes it transaction-local, equivalent to
            # SET LOCAL.
            await session.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(tenant_id)},
            )
            yield session
