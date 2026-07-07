from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    APP_NAME: str = "Finance Tracker API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/finance_tracker"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/finance_tracker"

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    OLLAMA_BASE_URL: str = "https://ollama.com"
    OLLAMA_MODEL: str = "gpt-oss:120b-cloud"
    OLLAMA_API_KEY: str = ""
    EMBEDDING_MODEL: str = "mxbai-embed-large"
    EMBEDDING_DIMENSION: int = 1024
    CONVERSATION_TTL_HOURS: int = 24

    UPLOAD_DIR: str = "uploads"
    CORS_ORIGINS: str = "http://localhost:5173"

    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
