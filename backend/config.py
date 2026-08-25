from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB Configuration
    mongo_url: str
    db_name: str

    # JWT Configuration
    jwt_secret: str

    # Encryption Configuration
    encryption_key: str

    # Frontend Configuration
    frontend_url: str = "http://localhost:3000"

    # CORS Configuration
    # Comma-separated list of allowed origins
    cors_origins: str = "http://localhost:3000,https://app.millii.ai,https://milli-backend-612907011547.asia-south2.run.app"

    # LLM API Keys
    emergent_llm_key: Optional[str] = None
    openai_api_key: Optional[str] = None

    # Jibble Configuration
    jibble_client_id: str = ""
    jibble_client_secret: str = ""
    jibble_secret_key: Optional[str] = None

    # GoHighLevel Email Configuration
    ghl_api_key: Optional[str] = None
    ghl_api_base_url: str = "https://services.leadconnectorhq.com"
    ghl_sub_account_id: Optional[str] = None

    # Email Defaults
    default_from_email: str = "no-reply@millii.ai"
    default_from_name: str = "Millii"

    # Script Configuration
    preserve_user_email: str = "irfan@millionaze.com"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Create a singleton instance
settings = Settings()
