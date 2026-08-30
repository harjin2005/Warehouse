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
