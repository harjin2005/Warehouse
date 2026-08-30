from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Runtime connection: the FastAPI app connects as `warehouse_runtime`, a
    # plain LOGIN role with no superuser/BYPASSRLS privileges, so RLS
    # policies (migrations/versions/0002_rls_policies.py) actually restrict
    # what it can see. Never point this at a superuser role -- see the
    # design spec's "Two DB roles, not one" section.
    database_url: str = (
        "postgresql+asyncpg://warehouse_runtime:warehouse_runtime@localhost:5432/warehouse"
    )
    # Migration connection: Alembic needs an elevated/superuser-equivalent
    # role (CREATE ROLE, ALTER TABLE ... ENABLE ROW LEVEL SECURITY, etc.)
    # that the running app must never use for ordinary request traffic.
    migration_database_url: str = (
        "postgresql+asyncpg://warehouse_migrator:warehouse_migrator@localhost:5432/warehouse"
    )
    jwt_secret: str = "dev-secret-change-in-production"
    environment: str = "development"
    rls_bypass_role: str = "app_bypass_auth"

    # Password for the `warehouse_runtime` role (migrations/versions/0003_runtime_role.py
    # reads this, never os.environ directly, so it goes through the same
    # pydantic-settings validation/precedence as every other setting). The
    # literal below is a documented dev/test-only default -- every real
    # environment (anything where `environment` is not "development" or
    # "test") MUST set RUNTIME_DB_PASSWORD itself. Migration 0003 raises if
    # it detects this default still in effect outside development/test, so
    # an unset env var in staging/production fails loudly instead of
    # silently resetting the role's password to a value visible in git
    # history.
    runtime_db_password: str = "warehouse_runtime_dev_password"


@lru_cache
def get_settings() -> Settings:
    return Settings()
