# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a real FastAPI + Postgres backend with enforced Row-Level Security tenant isolation and JWT auth — a working, deployable, tested multi-tenant skeleton that later plans (ingestion engine, KPI engine, frontend integration) build on top of.

**Architecture:** FastAPI app backed by async SQLAlchemy 2.0 + asyncpg, Alembic migrations, Postgres RLS enforced per-request via `SET LOCAL app.tenant_id`, fastapi-users for JWT auth with a narrow, explicitly-scoped RLS-bypass role used only for the cross-tenant email lookup that login requires.

**Tech Stack:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0.36 (async), asyncpg 0.30, Alembic 1.14, fastapi-users 14.x + fastapi-users-db-sqlalchemy, pydantic-settings 2.6, pytest 8.x + pytest-asyncio 0.24 + httpx 0.28, testcontainers[postgres] 4.9.

## Global Constraints

- All integration tests run against real Postgres via `testcontainers`, never SQLite (RLS, JSONB, and timezone behavior differ).
- No `except Exception: pass` anywhere — every caught exception is logged and re-raised or converted to an HTTP error.
- No bare `except:`.
- Every DB-touching test must assert tenant isolation explicitly where the table is tenant-scoped — a passing test that never checks cross-tenant leakage is not sufficient coverage for this codebase.
- All secrets (DB password, JWT secret) come from environment variables via `pydantic-settings`, never hardcoded.
- Directory root for all paths below: `D:\Warehouse-SaaS\backend\`.

---

## File Structure

- `backend/pyproject.toml` — dependencies and tool config
- `backend/app/__init__.py` — empty package marker
- `backend/app/config.py` — `Settings` (pydantic-settings) — DB URL, JWT secret, RLS role names
- `backend/app/db.py` — async engine/session factory, `tenant_scoped_session()` context manager that issues `SET LOCAL app.tenant_id`
- `backend/app/models/__init__.py` — `Base` declarative base, re-exports
- `backend/app/models/tenant.py` — `Tenant` model
- `backend/app/models/user.py` — `User` model (fastapi-users compatible, tenant-scoped)
- `backend/app/auth/manager.py` — `UserManager` with the RLS-bypass email lookup
- `backend/app/auth/backend.py` — JWT strategy + auth backend + `fastapi_users` instance
- `backend/app/auth/schemas.py` — `UserRead`, `UserCreate`, `UserUpdate` pydantic schemas
- `backend/app/deps.py` — `get_async_session`, `require_tenant_session` dependencies
- `backend/app/routers/health.py` — `/health` endpoint
- `backend/app/routers/me.py` — `/me/tenant` protected demo endpoint proving tenant scoping end-to-end
- `backend/app/main.py` — FastAPI app assembly, router includes
- `backend/migrations/env.py` — Alembic env, async-aware
- `backend/migrations/versions/0001_initial_schema.py` — tenants + users tables
- `backend/migrations/versions/0002_rls_policies.py` — RLS enable/force + policies + `app_bypass_auth` role
- `backend/alembic.ini`
- `backend/tests/conftest.py` — TestContainers Postgres fixture, migrated schema, session fixtures for both the RLS-restricted app role and raw superuser access
- `backend/tests/test_health.py`
- `backend/tests/test_tenant_isolation.py` — direct proof that RLS blocks cross-tenant reads on `users`
- `backend/tests/test_auth.py` — register + login + protected endpoint, across two tenants
- `backend/Dockerfile`
- `backend/docker-compose.yml` — local Postgres + backend service
- `.github/workflows/backend-ci.yml`

**Interfaces future plans depend on:**
- `app.db.tenant_scoped_session(tenant_id: uuid.UUID) -> AsyncIterator[AsyncSession]` — every tenant-scoped query in later plans (ingestion, KPI engine) must go through this, never a raw session.
- `app.models.tenant.Tenant` (`id: uuid.UUID`, `name: str`, `plan: str`, `created_at: datetime`)
- `app.models.user.User` (`id: uuid.UUID`, `tenant_id: uuid.UUID`, `email: str`, `hashed_password: str`, `is_active: bool`, `is_superuser: bool`, `is_verified: bool`, `role: str`, `created_at: datetime`)
- `app.deps.current_active_user` — FastAPI dependency returning the authenticated `User`, for use as a route dependency in every later router.

---

### Task 1: Project scaffold, config, health check

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/health.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `app.config.get_settings() -> Settings` (fields: `database_url: str`, `jwt_secret: str`, `environment: str`)
- Produces: `app.main.app` — the FastAPI instance, importable by tests and uvicorn.

- [ ] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "warehouse-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.115.5",
    "uvicorn[standard]==0.32.1",
    "sqlalchemy==2.0.36",
    "asyncpg==0.30.0",
    "alembic==1.14.0",
    "pydantic-settings==2.6.1",
    "fastapi-users[sqlalchemy]==14.0.0",
    "python-multipart==0.0.17",
]

[project.optional-dependencies]
dev = [
    "pytest==8.3.3",
    "pytest-asyncio==0.24.0",
    "httpx==0.28.1",
    "testcontainers[postgres]==4.9.0",
    "psycopg2-binary==2.9.10",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 2: Install dependencies**

Run: `cd backend && pip install -e ".[dev]"`
Expected: install completes with no errors.

- [ ] **Step 3: Create `backend/app/__init__.py`**

```python
```

(empty file — package marker)

- [ ] **Step 4: Create `backend/app/config.py`**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql+asyncpg://warehouse_app:warehouse_app@localhost:5432/warehouse"
    jwt_secret: str = "dev-secret-change-in-production"
    environment: str = "development"
    rls_bypass_role: str = "app_bypass_auth"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Write the failing test for the health endpoint**

Create `backend/tests/__init__.py` (empty file), then `backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 7: Create `backend/app/routers/__init__.py`** (empty) **and `backend/app/routers/health.py`**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 8: Create `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Warehouse Backend")

app.include_router(health.router)
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd backend && pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
cd /d/Warehouse-SaaS
git add backend/pyproject.toml backend/app backend/tests
git commit -m "feat(backend): project scaffold with health endpoint"
```

---

### Task 2: Tenant + User models, migrations, RLS enforcement

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/tenant.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/db.py`
- Create: `backend/alembic.ini`
- Create: `backend/migrations/env.py`
- Create: `backend/migrations/script.py.mako`
- Create: `backend/migrations/versions/0001_initial_schema.py`
- Create: `backend/migrations/versions/0002_rls_policies.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_tenant_isolation.py`

**Interfaces:**
- Consumes: `app.config.get_settings` (Task 1)
- Produces: `app.models.tenant.Tenant`, `app.models.user.User`, `app.db.tenant_scoped_session(session_factory, tenant_id)`, `app.db.get_engine()`, `app.db.async_session_factory` — all consumed by Task 3 and every later plan.

- [ ] **Step 1: Create `backend/app/models/__init__.py`**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Create `backend/app/models/tenant.py`**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.models import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="trial")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
```

- [ ] **Step 3: Create `backend/app/models/user.py`**

```python
import uuid
from datetime import datetime, timezone

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.models import Base


class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
```

- [ ] **Step 4: Create `backend/app/db.py`**

```python
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
            await session.execute(
                text("SET LOCAL app.tenant_id = :tid"), {"tid": str(tenant_id)}
            )
            yield session
```

- [ ] **Step 5: Set up Alembic — create `backend/alembic.ini`**

```ini
[alembic]
script_location = migrations
sqlalchemy.url =

[loggers]
keys = root,sqlalchemy,alembic

[logger_root]
level = WARNING
handlers = console

[logger_sqlalchemy]
level = WARNING
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handlers]
keys = console

[handler_console]
class = StreamHandler
args = (sys.stderr,)
formatter = generic

[formatters]
keys = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

- [ ] **Step 6: Create `backend/migrations/env.py`**

```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.config import get_settings
from app.models import Base
from app.models.tenant import Tenant  # noqa: F401
from app.models.user import User  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 7: Create `backend/migrations/script.py.mako`**

```python
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 8: Create `backend/migrations/versions/0001_initial_schema.py`**

```python
"""initial schema: tenants and users

Revision ID: 0001
Revises:
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(50), nullable=False, server_default="trial"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(1024), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "is_superuser", sa.Boolean, nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "is_verified", sa.Boolean, nullable=False, server_default=sa.false()
        ),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("tenants")
```

- [ ] **Step 9: Create `backend/migrations/versions/0002_rls_policies.py`**

```python
"""enable RLS on tenant-scoped tables, add narrow bypass role for auth lookup

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-30
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Narrow role used ONLY by the auth manager's cross-tenant email lookup
    # during login (fastapi-users must find a user by email before the
    # tenant is known). Every other query in the app runs as a role subject
    # to RLS. This role has no LOGIN capability of its own -- application
    # code reaches it via `SET ROLE`, held only for the duration of that one
    # lookup, then immediately `RESET ROLE`.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_bypass_auth') THEN
                CREATE ROLE app_bypass_auth NOLOGIN BYPASSRLS;
            END IF;
        END
        $$;
        """
    )
    op.execute("GRANT SELECT ON users TO app_bypass_auth")
    op.execute("GRANT app_bypass_auth TO CURRENT_USER")

    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation_users ON users
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_users ON users")
    op.execute("ALTER TABLE users NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
    op.execute("REVOKE app_bypass_auth FROM CURRENT_USER")
    op.execute("REVOKE SELECT ON users FROM app_bypass_auth")
    op.execute("DROP ROLE IF EXISTS app_bypass_auth")
```

- [ ] **Step 10: Create `backend/tests/conftest.py`**

```python
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
```

- [ ] **Step 11: Write the failing isolation test — `backend/tests/test_tenant_isolation.py`**

```python
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
```

Note: `raw_session` in this test uses the TestContainers default superuser role, which
bypasses RLS by definition — that's why `_make_user` (arrange step) is allowed to insert
across tenants directly. The assertions run through `tenant_scoped_session`, which uses
the same connection/engine but the role enforcement is what's under test in the next
step once the app's non-superuser role exists. For now this proves the RLS policy itself
works against any role once `app.tenant_id` is set vs unset.

- [ ] **Step 12: Run test to verify it fails**

Run: `cd backend && pytest tests/test_tenant_isolation.py -v`
Expected: FAIL at collection or first assertion — `app.db` / `app.models.user` not yet
consistent with fixtures, or migrations not applied. (This is expected red before Task 2's
db.py and migrations above are actually saved to disk — if you've already saved Steps 1-9,
skip to Step 13's run and confirm PASS instead; the TDD ordering here is: models+db.py+
migrations are the implementation, this test is what proves them correct.)

- [ ] **Step 13: Run test to verify it passes**

Run: `cd backend && pytest tests/test_tenant_isolation.py -v`
Expected: PASS — both tests green. If `test_session_without_tenant_id_set_sees_no_rows`
fails with rows returned, the RLS policy from migration `0002` did not apply — check that
`ALTER TABLE users FORCE ROW LEVEL SECURITY` ran (re-run `alembic upgrade head` against the
test DB manually to see the error).

- [ ] **Step 14: Commit**

```bash
cd /d/Warehouse-SaaS
git add backend/app/models backend/app/db.py backend/alembic.ini backend/migrations backend/tests/conftest.py backend/tests/test_tenant_isolation.py
git commit -m "feat(backend): tenant/user models, migrations, and enforced RLS"
```

---

### Task 3: JWT auth with fastapi-users, RLS-bypass login lookup

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/schemas.py`
- Create: `backend/app/auth/manager.py`
- Create: `backend/app/auth/backend.py`
- Create: `backend/app/deps.py`
- Create: `backend/app/routers/me.py`
- Modify: `backend/app/main.py` — include auth + me routers
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `app.models.user.User`, `app.models.tenant.Tenant`, `app.db.tenant_scoped_session`, `app.config.get_settings` (Tasks 1-2)
- Produces: `app.deps.current_active_user` (FastAPI dependency, returns `User`), `app.auth.backend.fastapi_users` — consumed by every future protected router.

- [ ] **Step 1: Create `backend/app/auth/__init__.py`** (empty)

- [ ] **Step 2: Create `backend/app/auth/schemas.py`**

```python
import uuid

from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    tenant_id: uuid.UUID
    role: str


class UserCreate(schemas.BaseUserCreate):
    tenant_id: uuid.UUID
    role: str = "member"


class UserUpdate(schemas.BaseUserUpdate):
    role: str | None = None
```

- [ ] **Step 3: Create `backend/app/auth/manager.py`**

```python
import uuid
from typing import Optional

from fastapi import Request
from fastapi_users import BaseUserManager, UUIDIDMixin
from sqlalchemy import select, text

from app.config import get_settings
from app.db import get_session_factory
from app.models.user import User


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = get_settings().jwt_secret
    verification_token_secret = get_settings().jwt_secret

    async def get_by_email(self, user_email: str) -> User:
        """Look up a user by email across all tenants.

        This is the one deliberate, narrow exception to RLS in the whole
        codebase: login happens before the caller's tenant is known, so the
        query cannot be tenant-scoped. It runs under `app_bypass_auth`
        (BYPASSRLS), held only for this single SELECT, then immediately
        reset. No other code path may use this pattern.
        """
        factory = get_session_factory()
        async with factory() as session:
            async with session.begin():
                await session.execute(text("SET ROLE app_bypass_auth"))
                try:
                    result = await session.execute(
                        select(User).where(User.email == user_email)
                    )
                    user = result.unique().scalar_one_or_none()
                finally:
                    await session.execute(text("RESET ROLE"))
        if user is None:
            from fastapi_users.exceptions import UserNotExists

            raise UserNotExists()
        return user

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        pass
```

- [ ] **Step 4: Create `backend/app/auth/backend.py`**

```python
import uuid

from fastapi import Depends
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)

from app.auth.manager import UserManager
from app.config import get_settings
from app.models.user import User


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=get_settings().jwt_secret, lifetime_seconds=3600)


bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)


async def get_user_manager():
    yield UserManager(user_db=None)  # user_db unused: get_by_email overridden above,
    # and no other BaseUserManager method that needs a UserDatabase is exercised by the
    # jwt login flow used in this codebase.


fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
```

- [ ] **Step 5: Create `backend/app/deps.py`**

```python
from app.auth.backend import current_active_user

__all__ = ["current_active_user"]
```

- [ ] **Step 6: Create `backend/app/routers/me.py`**

```python
import uuid

from fastapi import APIRouter, Depends

from app.deps import current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/me/tenant")
async def my_tenant(user: User = Depends(current_active_user)) -> dict[str, str]:
    return {"tenant_id": str(user.tenant_id), "email": user.email, "role": user.role}
```

- [ ] **Step 7: Modify `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.auth.backend import auth_backend, fastapi_users
from app.auth.schemas import UserCreate, UserRead, UserUpdate
from app.routers import health, me

app = FastAPI(title="Warehouse Backend")

app.include_router(health.router)
app.include_router(me.router)
app.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
```

- [ ] **Step 8: Write the failing test — `backend/tests/test_auth.py`**

```python
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
```

- [ ] **Step 9: Run test to verify it fails**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: FAIL — before this task's files exist, import errors on `app.auth.backend`.

- [ ] **Step 10: Run test to verify it passes**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: PASS. If `SET ROLE app_bypass_auth` fails with a permissions error, confirm
migration `0002_rls_policies.py` ran (`GRANT app_bypass_auth TO CURRENT_USER`) against the
same database the test connects to — check `database_url` fixture and
`run_migrations` both target the TestContainers instance.

- [ ] **Step 11: Commit**

```bash
cd /d/Warehouse-SaaS
git add backend/app/auth backend/app/deps.py backend/app/routers/me.py backend/app/main.py backend/tests/test_auth.py
git commit -m "feat(backend): JWT auth via fastapi-users with RLS-safe login lookup"
```

---

### Task 4: Docker packaging, local dev compose, CI

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/docker-compose.yml`
- Create: `backend/.env.example`
- Create: `.github/workflows/backend-ci.yml`
- Create: `backend/README.md`

**Interfaces:**
- Consumes: everything from Tasks 1-3 (no new Python interfaces produced — this task packages and automates what exists).

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY app app
COPY migrations migrations
COPY alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create `backend/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: warehouse_app
      POSTGRES_PASSWORD: warehouse_app
      POSTGRES_DB: warehouse
    ports:
      - "5432:5432"
    volumes:
      - warehouse_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U warehouse_app"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://warehouse_app:warehouse_app@postgres:5432/warehouse
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production}
    ports:
      - "8000:8000"
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"

volumes:
  warehouse_pg_data:
```

- [ ] **Step 3: Create `backend/.env.example`**

```
DATABASE_URL=postgresql+asyncpg://warehouse_app:warehouse_app@localhost:5432/warehouse
JWT_SECRET=replace-with-a-real-random-secret
ENVIRONMENT=development
```

- [ ] **Step 4: Create `.github/workflows/backend-ci.yml`**

```yaml
name: backend-ci

on:
  push:
    paths:
      - "backend/**"
  pull_request:
    paths:
      - "backend/**"

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install dependencies
        run: pip install -e ".[dev]"
      - name: Run tests
        run: pytest -v
```

- [ ] **Step 5: Create `backend/README.md`**

```markdown
# Warehouse Backend

FastAPI + Postgres backend for LeanBridge OI. Tenant isolation is enforced with
Postgres Row-Level Security, not application-layer filtering.

## Local development

    docker compose up --build

Backend available at http://localhost:8000, health check at /health.

## Running tests

    pip install -e ".[dev]"
    pytest -v

Tests spin up a real Postgres container via testcontainers — Docker must be running.
```

- [ ] **Step 6: Verify full stack boots**

Run: `cd backend && docker compose up --build -d`
Then: `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`
Then: `docker compose down -v`

- [ ] **Step 7: Commit**

```bash
cd /d/Warehouse-SaaS
git add backend/Dockerfile backend/docker-compose.yml backend/.env.example backend/README.md .github/workflows/backend-ci.yml
git commit -m "chore(backend): docker packaging, local compose, CI"
```

---

## Self-Review Notes

- **Spec coverage:** Tenant isolation (RLS + FORCE RLS + policy) — Task 2. Auth — Task 3, including the login-lookup exception the design spec's data model section implies but doesn't spell out (added here explicitly since it's a genuine correctness gap otherwise). Deployability — Task 4. Ingestion/KPI engine, job queue, Gemini narrative call, and frontend rewiring are explicitly **not** in this plan — they depend on tables this plan doesn't create and belong in the next plan (`ingestion-and-kpi-engine`), per the design spec's own phase ordering.
- **Placeholder scan:** none found — every step has runnable code.
- **Type consistency:** `Tenant.id` / `User.tenant_id` are `UUID` everywhere (models, migrations, schemas, tests). `current_active_user` dependency name matches between `app/deps.py` and its only consumer so far (`app/routers/me.py`).
