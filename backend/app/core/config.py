from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base backend directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    """
    APP_ENV: str = "development"
    APP_NAME: str = "Aurel Home API"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database configuration
    DATABASE_URL: str = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres"

    # CORS configuration - comma-separated origins
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Supabase Auth Configuration
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_JWT_SECRET: str | None = None
    SUPABASE_ANON_KEY: str | None = None

    # Admin API key for backend automation. Disabled by default.
    # Set a high-entropy secret in .env to enable API-key authentication.
    ADMIN_API_KEY: str | None = None

    # Razorpay Test Mode Configuration
    RAZORPAY_KEY_ID: str = "rzp_test_placeholder"
    RAZORPAY_KEY_SECRET: str | None = None
    RAZORPAY_WEBHOOK_SECRET: str | None = None

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def clean_supabase_url(self) -> str:
        """
        Normalize Supabase URL. If dashboard URL was provided,
        extract project reference and convert to standard API domain.
        """
        url = self.SUPABASE_URL.strip().rstrip("/")
        if "supabase.com/dashboard/project/" in url:
            ref = url.split("supabase.com/dashboard/project/")[-1].split("/")[0].strip()
            return f"https://{ref}.supabase.co"
        return url

    @property
    def supabase_jwks_url(self) -> str:
        """Return full JWKS URL for asymmetric JWT verification."""
        return f"{self.clean_supabase_url}/auth/v1/.well-known/jwks.json"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated origins into a clean string list."""
        if not self.CORS_ORIGINS:
            return ["http://localhost:3000"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def admin_api_key_enabled(self) -> bool:
        """Admin API key is only enabled if explicitly set to a non-trivial value."""
        if not self.ADMIN_API_KEY:
            return False
        key = self.ADMIN_API_KEY.strip()
        # Reject known insecure defaults and short keys
        insecure_defaults = {
            "aurel-home-admin-secret-dev",
            "aurel-home-local-admin-secret-dev",
            "changeme",
            "secret",
            "admin",
            "",
        }
        if key.lower() in insecure_defaults:
            return False
        if len(key) < 32:
            return False
        return True

    @property
    def sync_database_url(self) -> str:
        """
        Normalize DATABASE_URL for SQLAlchemy psycopg2 compatibility.
        Converts 'postgres://' or 'postgresql://' to 'postgresql+psycopg2://'
        while preserving SQLite or existing driver schemes, and ensures
        sslmode=require for Supabase hosts.
        """
        import urllib.parse

        url = self.DATABASE_URL.strip()

        # Handle unescaped @ symbols in password if present
        if "://" in url and url.count("@") > 1:
            last_at = url.rfind("@")
            auth_part = url[:last_at]
            host_part = url[last_at + 1 :]
            scheme, user_pass = auth_part.split("://", 1)
            if ":" in user_pass:
                user, password = user_pass.split(":", 1)
                encoded_password = urllib.parse.quote_plus(password)
                url = f"{scheme}://{user}:{encoded_password}@{host_part}"

        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

        # Ensure sslmode=require for remote Supabase connections if not specified
        if ("supabase.co" in url or "supabase.com" in url) and "sslmode=" not in url:
            delimiter = "&" if "?" in url else "?"
            url = f"{url}{delimiter}sslmode=require"

        return url


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
