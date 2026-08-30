import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from testcontainers.postgres import PostgresContainer

from alembic import command
from alembic.config import Config

import app.config as app_config


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest.fixture(scope="session")
def database_url(postgres_container) -> str:
    raw = postgres_container.get_connection_url()  # postgresql+psycopg2://...
    return raw.replace("postgresql+psycopg2://", "postgresql+asyncpg://")


@pytest.fixture(scope="session", autouse=True)
def run_migrations(database_url):
    app_config.get_settings.cache_clear()
    import os

    os.environ["DATABASE_URL"] = database_url
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(cfg, "head")
    yield


@pytest_asyncio.fixture
async def db_engine(database_url):
    engine = create_async_engine(database_url)
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
