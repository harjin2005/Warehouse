import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from testcontainers.postgres import PostgresContainer

from alembic import command
from alembic.config import Config

import app.config as app_config
import app.db as app_db

# Test-only password for the `warehouse_runtime` role created by migration
# 0003 against the ephemeral TestContainers instance. Never used outside
# tests -- real environments must set RUNTIME_DB_PASSWORD themselves.
_TEST_RUNTIME_PASSWORD = "test_only_runtime_password"


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest.fixture(scope="session")
def database_url(postgres_container) -> str:
    """Superuser connection string (TestContainers default role).

    Used ONLY for test arrangement (`raw_session`) and for running
    migrations, which genuinely need elevated privileges (CREATE ROLE,
    ENABLE ROW LEVEL SECURITY). Never use this for the sessions under test
    -- see `runtime_database_url` below.
    """
    raw = postgres_container.get_connection_url()  # postgresql+psycopg2://...
    return raw.replace("postgresql+psycopg2://", "postgresql+asyncpg://")


@pytest.fixture(scope="session")
def runtime_database_url(database_url) -> str:
    """Connection string for the restricted, non-superuser `warehouse_runtime`
    role that migration 0003 creates.

    This is the role RLS-enforcement tests must actually connect as: the
    TestContainers default user (`database_url`) is a real Postgres
    superuser and unconditionally bypasses RLS regardless of
    FORCE ROW LEVEL SECURITY, so it can never prove the policy restricts
    anything (see .superpowers/sdd/task-2-report.md for the original
    finding).
    """
    url = make_url(database_url)
    runtime_url = url.set(username="warehouse_runtime", password=_TEST_RUNTIME_PASSWORD)
    return runtime_url.render_as_string(hide_password=False)


@pytest.fixture(scope="session", autouse=True)
def run_migrations(database_url, runtime_database_url):
    app_config.get_settings.cache_clear()

    # `DATABASE_URL` is what `app.config.Settings.database_url` resolves to,
    # which is what `app.db.get_engine()` uses for every ordinary request --
    # including the full ASGI app exercised end-to-end in test_auth.py. It
    # must point at the restricted `warehouse_runtime` role, never the
    # TestContainers superuser: pointing it at the superuser would make
    # every RLS policy silently decorative for any test that hits the real
    # app instead of monkeypatching app.db._engine directly (as
    # test_tenant_isolation.py does), which defeats the entire point of
    # testing against real Postgres with RLS enforced.
    os.environ["DATABASE_URL"] = runtime_database_url
    # Migrations (including 0003, which creates warehouse_runtime) must run
    # as the elevated TestContainers superuser -- that's what
    # migration_database_url needs to point at in this environment. This is
    # analogous to warehouse_migrator in real deployments.
    os.environ["MIGRATION_DATABASE_URL"] = database_url
    os.environ["RUNTIME_DB_PASSWORD"] = _TEST_RUNTIME_PASSWORD
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(cfg, "head")
    app_config.get_settings.cache_clear()
    yield


@pytest_asyncio.fixture(autouse=True)
async def _reset_app_db_engine_state():
    """Guarantee `app.db`'s cached engine/session factory are rebuilt fresh
    for every test.

    `app.db._engine`/`_session_factory` are process-global singletons, but
    this suite's asyncio loop scope is per-function (see pyproject.toml's
    `asyncio_default_fixture_loop_scope`), so each test runs on its own
    event loop. An asyncpg connection pool created against one test's loop
    breaks with "Event loop is closed" if a later test's (different) loop
    tries to reuse it. `test_tenant_isolation.py` sidesteps this by
    monkeypatching `_engine` directly every test; `test_auth.py` exercises
    the real app end-to-end and relies on `app.db.get_engine()` building
    its own engine lazily, so it needs this reset instead.
    """
    app_db._engine = None
    app_db._session_factory = None
    yield
    engine = app_db._engine
    app_db._engine = None
    app_db._session_factory = None
    if engine is not None:
        await engine.dispose()


@pytest_asyncio.fixture
async def db_engine(database_url):
    """Superuser engine -- test arrangement only, never for assertions."""
    engine = create_async_engine(database_url)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def runtime_engine(runtime_database_url, run_migrations):
    """Engine connected as the restricted, non-superuser `warehouse_runtime`
    role. This is the engine RLS-enforcement test assertions must run
    through."""
    engine = create_async_engine(runtime_database_url)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def raw_session(db_engine):
    """Unrestricted session (test superuser) for arranging fixture data."""
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def tenant_a_id(raw_session) -> uuid.UUID:
    from app.models.tenant import Tenant

    tenant = Tenant(name="Tenant A", plan="trial")
    raw_session.add(tenant)
    await raw_session.commit()
    return tenant.id


@pytest_asyncio.fixture
async def tenant_b_id(raw_session) -> uuid.UUID:
    from app.models.tenant import Tenant

    tenant = Tenant(name="Tenant B", plan="trial")
    raw_session.add(tenant)
    await raw_session.commit()
    return tenant.id
