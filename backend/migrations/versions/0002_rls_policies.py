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
