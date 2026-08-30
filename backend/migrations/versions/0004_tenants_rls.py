"""enable RLS on tenants, scoped on its own id column

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-30

Why this migration exists
--------------------------
Migration 0003 originally left `tenants` without RLS on the reasoning that
it is the tenant registry itself (one row per tenant) rather than a table
owned by a single tenant, so there was no `tenant_id` column to scope a
policy on. That left `warehouse_runtime` -- the plain, non-superuser role
the FastAPI app actually connects as -- able to `SELECT` every tenant's
registry row via a blanket table-level grant, with no row-level
restriction at all. That is fully enumerable: any query path that forgets
(or is tricked into skipping) an application-layer `WHERE id = :tenant_id`
filter leaks every other tenant's name/plan/created_at.

This migration closes that gap the same way migration 0002 already does
for `users`: enable + force RLS on `tenants`, with a policy that restricts
visible rows to the tenant identified by `current_setting('app.tenant_id')`
-- except the policy compares against `tenants.id` directly (its own
primary key) rather than a `tenant_id` foreign-key column, since `tenants`
has no such column.

This is a separate migration from 0002 (rather than editing 0002) because
0002 predates the decision to add RLS to `tenants` -- this is a new schema
change, not a fix to something 0002 got wrong at the time it was written.
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenants FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation_tenants ON tenants
        -- NOTE: a session variable value that is non-empty and not a valid
        -- UUID (e.g. malformed input) makes this cast raise an error, not
        -- silently return zero rows. Callers that set app.tenant_id (see
        -- Task 3) must guarantee it is always either unset or a real UUID.
        USING (id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (id = current_setting('app.tenant_id', true)::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants")
    op.execute("ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenants DISABLE ROW LEVEL SECURITY")
