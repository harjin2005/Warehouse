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
    # NOTE: this migration does not grant app_bypass_auth membership to any
    # role. The role that actually needs it -- `warehouse_runtime` -- is
    # granted membership in migration 0003, once that role exists.
    # `warehouse_migrator` (the role running migrations) is
    # superuser-equivalent and bypasses RLS on its own; it never needs
    # app_bypass_auth membership.

    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation_users ON users
        -- NOTE: a session variable value that is non-empty and not a valid
        -- UUID (e.g. malformed input) makes this cast raise an error, not
        -- silently return zero rows. Callers that set app.tenant_id (see
        -- Task 3) must guarantee it is always either unset or a real UUID.
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_users ON users")
    op.execute("ALTER TABLE users NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
    op.execute("REVOKE SELECT ON users FROM app_bypass_auth")
    op.execute("DROP ROLE IF EXISTS app_bypass_auth")
