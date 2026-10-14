import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENV: str = "development"
    PROJECT_NAME: str = "TradeX AI"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "development-secret-key-tradex-32bytes-secure"
    ACCESS_TOKEN_MINUTES: int = 1440

    # Server settings
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:80",
    ]

    # Database URLs
    DATABASE_URL: str = "postgresql+asyncpg://tradex_user:tradex_password@db:5432/tradex"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://tradex_user:tradex_password@db:5432/tradex"

    # AI Provider & Models
    AI_PROVIDER: str = "mock"  # mock, ollama, openrouter, groq, gemini, anthropic
    AI_MODEL: str = "qwen2.5:3b"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instruct:free"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    EMBEDDING_PROVIDER: str = "mock"  # mock, ollama, openai
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536
    AI_TIMEOUT_SECONDS: float = 30.0

    # Storage
    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_PATH: str = "/app/storage"

    # Admin Security & MFA
    ADMIN_REQUIRE_MFA: bool = False
    ADMIN_BOOTSTRAP_EMAIL: str = ""
    ADMIN_BOOTSTRAP_PASSWORD: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
