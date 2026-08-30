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


@lru_cache
def get_settings() -> Settings:
    return Settings()
