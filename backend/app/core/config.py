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
    AI_MODEL: str = "llama-3.3-70b-versatile"
    AI_MODEL_FAST: str = "llama-3.1-8b-instant"  # Classification, intent, short tips
    AI_MODEL_SMART: str = "llama-3.3-70b-versatile"  # Reasoning, drafting, analysis
    AI_MODEL_VISION: str = "llama-3.2-11b-vision-preview"  # Vision/image document extraction
    AI_MODEL_INTENT: str = ""
    AI_MODEL_ANSWER: str = ""
    AI_PROVIDER_PRIORITY: str = "groq,openrouter,ollama,gemini"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instruct:free"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    EMBEDDING_PROVIDER: str = "local"  # local, ollama, openai, mock
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 1536
    AI_TIMEOUT_SECONDS: float = 30.0
    AI_DAILY_BUDGET: int = 10000

    # AI Feature Flags (Enable/Disable per feature dynamically)
    AI_FLAG_SEARCH: bool = True
    AI_FLAG_AI_MODE: bool = True
    AI_FLAG_COPILOT: bool = True
    AI_FLAG_RFQ_DRAFT: bool = True
    AI_FLAG_QUOTE_COMPARE: bool = True
    AI_FLAG_NEGOTIATION: bool = True
    AI_FLAG_PRODUCT_SUMMARY: bool = True
    AI_FLAG_SHIPMENT_SUMMARY: bool = True
    AI_FLAG_ANALYTICS: bool = True
    AI_FLAG_LISTING_WRITER: bool = True
    AI_FLAG_INQUIRY_REPLY: bool = True
    AI_FLAG_PROFILE_TIPS: bool = True
    AI_FLAG_RFQ_OPPORTUNITY: bool = True
    AI_FLAG_DOC_EXTRACTION: bool = True
    AI_FLAG_MODERATION: bool = True

    def is_feature_enabled(self, feature: str) -> bool:
        clean = feature.upper().replace("-", "_").replace(" ", "_")
        key = f"AI_FLAG_{clean}"
        return getattr(self, key, True)

    # Storage
    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_PATH: str = "/app/storage"

    # Admin Security & MFA
    ADMIN_REQUIRE_MFA: bool = False
    ADMIN_BOOTSTRAP_EMAIL: str = ""
    ADMIN_BOOTSTRAP_PASSWORD: str = ""

    # Catalog & Approval Workflow (Prompt 15)
    REQUIRE_PRODUCT_APPROVAL: bool = True
    STALE_PRICE_DAYS: int = 30
    STALE_INVENTORY_DAYS: int = 14

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
