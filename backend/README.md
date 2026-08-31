# Warehouse Backend

FastAPI + Postgres backend for LeanBridge OI. Tenant isolation is enforced with
Postgres Row-Level Security, not application-layer filtering.

## Two database roles, not one

This backend never lets the running app connect as a Postgres superuser. The
official `postgres` Docker image's `POSTGRES_USER` **is** a superuser, and
Postgres superusers unconditionally bypass Row-Level Security -- so the app
process and the migration process use two different roles:

- **`warehouse_migrator`** -- the Postgres container's own bootstrap
  superuser (set via `POSTGRES_USER`/`POSTGRES_PASSWORD` in
  `docker-compose.yml`). Used ONLY to run `alembic upgrade head`, which needs
  `CREATE ROLE` / `ENABLE ROW LEVEL SECURITY` privileges.
- **`warehouse_runtime`** -- a plain `LOGIN` role with no
  superuser/`BYPASSRLS` privileges, created BY the migrations themselves
  (`migrations/versions/0003_runtime_role.py`), granted only the DML it
  needs. This is the role `uvicorn` actually connects as to serve real
  request traffic, and the role RLS policies are meant to restrict.

`docker-compose.yml`'s `backend` service therefore runs migrations against
`MIGRATION_DATABASE_URL` (pointing at `warehouse_migrator`) before starting
`uvicorn` against `DATABASE_URL` (pointing at `warehouse_runtime`). Both the
`DATABASE_URL` password and the standalone `RUNTIME_DB_PASSWORD` variable are
interpolated from the same `RUNTIME_DB_PASSWORD` host environment variable
with the same default, so the password migration 0003 assigns to
`warehouse_runtime` and the password `uvicorn` connects with can never drift
apart. See `app/config.py` and `migrations/versions/0003_runtime_role.py` for
the full rationale.

## Local development

    docker compose up --build

This starts Postgres (mapped to host port **55432**, not 5432, in case
another project's Postgres container already holds 5432 on your machine),
runs `alembic upgrade head` (creating `warehouse_runtime` along the way),
then starts `uvicorn`.

Backend available at http://localhost:8000, health check at `/health`.

Tear down with:

    docker compose down -v

(`-v` also removes the named Postgres volume, so the next `up` starts from a
clean database.)

### Manual smoke test

```bash
curl http://localhost:8000/health
# {"status":"ok"}

# There's no self-service tenant-creation endpoint yet, so a tenant row must
# exist before /auth/register can reference it. Insert one directly as the
# migrator role for a manual smoke test:
docker compose exec postgres psql -U warehouse_migrator -d warehouse \
  -c "INSERT INTO tenants (id, name, plan) VALUES (gen_random_uuid(), 'Smoke Test Inc', 'trial') RETURNING id;"

# Use the returned id below:
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@example.com","password":"correct-horse-battery-staple","tenant_id":"<id-from-above>"}'

curl -X POST http://localhost:8000/auth/jwt/login \
  -d "username=smoke@example.com&password=correct-horse-battery-staple"
```

## Running tests

    pip install -e ".[dev]"
    pytest -v

Tests spin up a real Postgres container via testcontainers — Docker must be
running. Tests always run migrations (including 0003/0004) and exercise the
app through the restricted `warehouse_runtime` role, never the test
superuser, so RLS enforcement is genuinely verified rather than bypassed.
