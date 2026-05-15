from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/tictactoe"

    # Amzur LiteLLM Proxy
    LITELLM_PROXY_URL: str = "https://litellm.amzur.com"
    LITELLM_API_KEY: str = "sk-placeholder"
    LLM_MODEL: str = "gemini/gemini-2.5-flash"

    # Agent behaviour
    AGENT_MODE: str = "llm"       # "llm" | "minimax" | "random"
    AGENT_EXPLAIN: bool = True    # whether to make a second call for move reasoning

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"


settings = Settings()
