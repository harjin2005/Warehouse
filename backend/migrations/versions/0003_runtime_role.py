"""create warehouse_runtime role: the non-superuser role the app connects as

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-30

Why this migration exists
--------------------------
Task 2's review found that the design as originally built had exactly one
Postgres role: whatever `POSTGRES_USER` the deployment sets. The official
postgres Docker image creates `POSTGRES_USER` as a superuser. Superusers
(and BYPASSRLS roles) unconditionally bypass Row-Level Security, regardless
of `FORCE ROW LEVEL SECURITY` -- so if the FastAPI app connected as that same
user for ordinary request traffic, every RLS policy in migration 0002 would
be silently decorative in production. This migration creates the second,
restricted role the design spec's "Two DB roles, not one" section calls for:

- `warehouse_migrator` (not created here -- it's whatever elevated/superuser
  role Alembic already connects as; see app/config.py's
  `migration_database_url` and migrations/env.py) creates schema, enables
  RLS, and runs this migration.
- `warehouse_runtime` (created here) is a plain LOGIN role with no
  superuser, no BYPASSRLS, granted only the table-level DML it needs. This
  is the role the FastAPI app actually connects as at runtime, and the role
  RLS policies are meant to restrict.

Password handling
------------------
Postgres does not support bind parameters inside DDL (CREATE ROLE / ALTER
ROLE), so the usual SQLAlchemy `text(...).bindparams(...)` mechanism cannot
parameterize a CREATE ROLE statement directly. To avoid ever string-
interpolating the password into migration source (which would make it
trivially visible in the file and vulnerable to SQL-metacharacter breakage),
this migration:

  1. Sends the password to Postgres as a genuine bound parameter via
     `SELECT set_config(...)` -- a normal function call, which (unlike
     `SET`/`SET LOCAL`) does accept bind parameters over asyncpg's extended
     query protocol (same technique already used in app/db.py for
     `app.tenant_id`).
  2. Reads it back inside a PL/pgSQL DO block via `current_setting(...)`
     and uses `format(..., %L)` to safely literal-quote it before handing
     it to `EXECUTE` for the actual CREATE/ALTER ROLE. `%L` performs
     Postgres's own literal escaping, so the value is never spliced into
     the SQL text by Python string formatting.

The password itself is never hardcoded as a real secret in this file. It is
read via `get_settings().runtime_db_password` -- the same pydantic-settings
mechanism `migration_database_url` already goes through -- never via a raw
`os.environ.get(...)` with a hardcoded fallback baked into this migration.
`RUNTIME_DB_PASSWORD` must be set in every real environment (staging/
production); `Settings.runtime_db_password`'s own default is a documented
dev/test-only value. If this migration runs with `environment` set to
anything other than `"development"`/`"test"` and the password still equals
that known dev-default literal, it raises `RuntimeError` instead of
silently applying a credential that is visible in git history -- an unset
`RUNTIME_DB_PASSWORD` in a real environment fails the migration instead of
quietly resetting `warehouse_runtime`'s password to a known-bad value.

Tenant scoping decision: `tenants`
------------------------------------
This migration grants `warehouse_runtime` SELECT/INSERT/UPDATE on `tenants`
(needed for signup and plan changes) but not DELETE (tenant deletion is a
destructive, unimplemented operation deliberately left to a future explicit
admin path, not ordinary request traffic). At the time this migration was
first written, RLS was deliberately NOT applied to `tenants` -- it has no
`tenant_id` column of its own, being the tenant registry rather than a
table owned by a single tenant. That decision was revisited: migration 0004
adds RLS to `tenants` scoped on its own `id` column, so `warehouse_runtime`
can now only see the calling tenant's own registry row.
"""
import sqlalchemy as sa
from alembic import op

from app.config import get_settings

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

_GUC_KEY = "warehouse_runtime_migration.password"

# Role attributes shared by both the CREATE and ALTER branches below --
# extracted once so the two branches can never silently drift apart.
_ROLE_ATTRS = "NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION"

# Must match Settings.runtime_db_password's own default exactly -- this is
# the literal we refuse to let reach a real environment silently.
_DEV_DEFAULT_PASSWORD = "warehouse_runtime_dev_password"


def upgrade() -> None:
    settings = get_settings()
    password = settings.runtime_db_password

    if (
        settings.environment not in ("development", "test")
        and password == _DEV_DEFAULT_PASSWORD
    ):
        raise RuntimeError(
            "RUNTIME_DB_PASSWORD is unset (or explicitly set to the "
            "documented dev-only default) while environment="
            f"{settings.environment!r}. Refusing to run migration 0003 "
            "against a non-development/test environment with the known "
            "dev-default password for warehouse_runtime -- set "
            "RUNTIME_DB_PASSWORD to a real secret for this environment."
        )

    # Step 1: hand the password to Postgres as a genuine bound parameter.
    # `false` (last arg to set_config) keeps this session-scoped -- it only
    # needs to survive for the duration of this migration's connection.
    op.execute(
        sa.text(f"SELECT set_config('{_GUC_KEY}', :password, false)").bindparams(
            sa.bindparam("password", value=password)
        )
    )

    op.execute(
        f"""
        DO $$
        DECLARE
            pwd text := current_setting('{_GUC_KEY}', true);
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'warehouse_runtime') THEN
                EXECUTE format(
                    'CREATE ROLE warehouse_runtime WITH LOGIN PASSWORD %L {_ROLE_ATTRS}',
                    pwd
                );
            ELSE
                EXECUTE format(
                    'ALTER ROLE warehouse_runtime WITH LOGIN PASSWORD %L {_ROLE_ATTRS}',
                    pwd
                );
            END IF;
        END
        $$;
        """
    )

    # Table-level DML the running app needs.
    op.execute("GRANT USAGE ON SCHEMA public TO warehouse_runtime")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON users TO warehouse_runtime")
    # tenants: registry table, not tenant-scoped -- see module docstring.
    # No DELETE: tenant deletion is not an implemented app operation.
    op.execute("GRANT SELECT, INSERT, UPDATE ON tenants TO warehouse_runtime")

    # Membership in the narrow bypass role (created in 0002) so the app can
    # `SET ROLE app_bypass_auth` / `RESET ROLE` for the single cross-tenant
    # login-lookup exception, without warehouse_runtime itself ever holding
    # BYPASSRLS.
    op.execute("GRANT app_bypass_auth TO warehouse_runtime")


def downgrade() -> None:
    op.execute("REVOKE app_bypass_auth FROM warehouse_runtime")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON tenants FROM warehouse_runtime")
    op.execute("REVOKE SELECT, INSERT, UPDATE, DELETE ON users FROM warehouse_runtime")
    op.execute("REVOKE USAGE ON SCHEMA public FROM warehouse_runtime")
    op.execute("DROP ROLE IF EXISTS warehouse_runtime")
