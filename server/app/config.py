"""Application settings.

pydantic-settings reads each field from environment variables (case-insensitive)
and from a .env file when present. Declaring fields as typed class attributes
eliminates manual os.getenv calls and gives IDE completion everywhere settings are used.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    anthropic_api_key: str
    access_token_expire_minutes: int = 60 * 24 * 7
    # Comma-separated list of allowed CORS origins.
    # Defaults to local Vite dev servers; override in production with the Cloud Run frontend URL.
    cors_origins: str = "http://localhost:5173,http://localhost:5174"

    class Config:
        env_file = ".env"


settings = Settings()
