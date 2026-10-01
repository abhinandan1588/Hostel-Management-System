"""Application configuration objects.

Every value that differs between environments is read from the environment so
that no secret ever lives in source control. See ``.env.example``.
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from the backend root if present (no-op in production containers
# where real environment variables are injected instead).
load_dotenv(BASE_DIR / ".env")


def _bool(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name, default):
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _csv(name, default=None):
    raw = os.getenv(name)
    if not raw:
        return list(default or [])
    return [item.strip() for item in raw.split(",") if item.strip()]


def normalize_database_url(url):
    """Normalise common PostgreSQL URL forms to the psycopg 3 driver.

    Hosting providers (Render, Railway, Heroku...) hand out ``postgres://``
    URLs which SQLAlchemy 2 no longer understands.
    """
    if not url:
        return url
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


class BaseConfig:
    # --- Core -------------------------------------------------------------
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-secret-key")
    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = True

    # --- Database ---------------------------------------------------------
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.getenv("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'hostel.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # --- JWT --------------------------------------------------------------
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY", "dev-only-jwt-secret"))
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=_int("JWT_ACCESS_TOKEN_MINUTES", 60))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=_int("JWT_REFRESH_TOKEN_DAYS", 30))
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"
    JWT_ERROR_MESSAGE_KEY = "message"

    # --- CORS -------------------------------------------------------------
    CORS_ORIGINS = _csv(
        "CORS_ORIGINS",
        ["http://localhost:5173", "http://127.0.0.1:5173"],
    )

    # --- Uploads ----------------------------------------------------------
    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER") or str(BASE_DIR / "uploads")
    MAX_CONTENT_LENGTH = _int("MAX_CONTENT_LENGTH", 8 * 1024 * 1024)  # 8 MB
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
    ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp"}
    IMAGE_MAX_DIMENSION = _int("IMAGE_MAX_DIMENSION", 1600)
    IMAGE_QUALITY = _int("IMAGE_QUALITY", 82)
    PUBLIC_MEDIA_BASE_URL = os.getenv("PUBLIC_MEDIA_BASE_URL", "")

    # --- Mail -------------------------------------------------------------
    MAIL_SERVER = os.getenv("MAIL_SERVER", "localhost")
    MAIL_PORT = _int("MAIL_PORT", 25)
    MAIL_USE_TLS = _bool("MAIL_USE_TLS", False)
    MAIL_USE_SSL = _bool("MAIL_USE_SSL", False)
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", "no-reply@hostel.local")
    MAIL_SUPPRESS_SEND = _bool("MAIL_SUPPRESS_SEND", True)
    MAIL_ENABLED = _bool("MAIL_ENABLED", False)

    # --- Rate limiting ----------------------------------------------------
    RATELIMIT_ENABLED = _bool("RATELIMIT_ENABLED", True)
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_DEFAULT = os.getenv("RATELIMIT_DEFAULT", "600 per hour")
    AUTH_RATELIMIT = os.getenv("AUTH_RATELIMIT", "10 per minute")

    # --- Application behaviour -------------------------------------------
    FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    PASSWORD_RESET_TOKEN_MINUTES = _int("PASSWORD_RESET_TOKEN_MINUTES", 60)
    MAX_FAILED_LOGIN_ATTEMPTS = _int("MAX_FAILED_LOGIN_ATTEMPTS", 10)
    DEFAULT_PAGE_SIZE = _int("DEFAULT_PAGE_SIZE", 20)
    MAX_PAGE_SIZE = _int("MAX_PAGE_SIZE", 100)
    SEND_SECURE_HEADERS = _bool("SEND_SECURE_HEADERS", True)

    # Werkzeug password hashing. Raise the iteration count over time; lowering
    # it is only ever acceptable in the test configuration.
    PASSWORD_HASH_METHOD = os.getenv("PASSWORD_HASH_METHOD", "pbkdf2:sha256:600000")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    ENV_NAME = "development"


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    ENV_NAME = "testing"
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    # Long enough to satisfy PyJWT's HMAC key-length recommendation.
    JWT_SECRET_KEY = "testing-jwt-secret-key-0123456789abcdef"
    SECRET_KEY = "testing-secret-key-0123456789abcdef"
    RATELIMIT_ENABLED = False
    MAIL_SUPPRESS_SEND = True
    MAIL_ENABLED = False
    UPLOAD_FOLDER = str(BASE_DIR / "tests" / "_uploads")
    # Tests create and verify hundreds of passwords; the production iteration
    # count would make the suite take minutes. Never use this outside tests.
    PASSWORD_HASH_METHOD = "pbkdf2:sha256:1000"


class ProductionConfig(BaseConfig):
    DEBUG = False
    ENV_NAME = "production"
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": _int("DB_POOL_SIZE", 10),
        "max_overflow": _int("DB_MAX_OVERFLOW", 20),
    }


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "dev": DevelopmentConfig,
    "testing": TestingConfig,
    "test": TestingConfig,
    "production": ProductionConfig,
    "prod": ProductionConfig,
}


def get_config(name=None):
    key = (name or os.getenv("FLASK_ENV") or "development").strip().lower()
    return CONFIG_MAP.get(key, DevelopmentConfig)
