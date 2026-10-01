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


def default_ratelimit_storage():
    """Prefer a shared store so limits hold across Gunicorn workers.

    ``memory://`` counts per process, so with N workers the effective limit is
    N times the configured one. Pointing ``REDIS_URL`` (Render Key Value) at the
    service fixes that without any code change.
    """
    explicit = os.getenv("RATELIMIT_STORAGE_URI")
    if explicit:
        return explicit
    redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_PRIVATE_URL")
    if redis_url:
        return redis_url
    return "memory://"


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
    RATELIMIT_STORAGE_URI = default_ratelimit_storage()
    RATELIMIT_DEFAULT = os.getenv("RATELIMIT_DEFAULT", "600 per hour")
    AUTH_RATELIMIT = os.getenv("AUTH_RATELIMIT", "10 per minute")

    # --- Reverse proxy ----------------------------------------------------
    # Render (and most PaaS) terminate TLS at a proxy. Without honouring the
    # X-Forwarded-* headers every request looks like it came from the proxy,
    # which would put all clients in one rate-limit bucket.
    TRUST_PROXY_HEADERS = _bool("TRUST_PROXY_HEADERS", False)
    PROXY_FIX_FOR = _int("PROXY_FIX_FOR", 1)
    PROXY_FIX_PROTO = _int("PROXY_FIX_PROTO", 1)
    PROXY_FIX_HOST = _int("PROXY_FIX_HOST", 1)
    PROXY_FIX_PREFIX = _int("PROXY_FIX_PREFIX", 0)

    # --- Application behaviour -------------------------------------------
    FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    PASSWORD_RESET_TOKEN_MINUTES = _int("PASSWORD_RESET_TOKEN_MINUTES", 60)
    MAX_FAILED_LOGIN_ATTEMPTS = _int("MAX_FAILED_LOGIN_ATTEMPTS", 10)
    DEFAULT_PAGE_SIZE = _int("DEFAULT_PAGE_SIZE", 20)
    MAX_PAGE_SIZE = _int("MAX_PAGE_SIZE", 100)
    SEND_SECURE_HEADERS = _bool("SEND_SECURE_HEADERS", True)
    ENABLE_HSTS = _bool("ENABLE_HSTS", False)
    HSTS_MAX_AGE = _int("HSTS_MAX_AGE", 31536000)
    # Allow a SQLite database in production only when explicitly opted in; on an
    # ephemeral PaaS filesystem it silently loses every record on redeploy.
    ALLOW_SQLITE_IN_PRODUCTION = _bool("ALLOW_SQLITE_IN_PRODUCTION", False)

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
    # Keep the per-worker pool small: managed Postgres plans cap total
    # connections, and the count multiplies by the number of Gunicorn workers.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": _int("DB_POOL_SIZE", 5),
        "max_overflow": _int("DB_MAX_OVERFLOW", 5),
    }
    PREFERRED_URL_SCHEME = "https"
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    # Behind a PaaS load balancer by default.
    TRUST_PROXY_HEADERS = _bool("TRUST_PROXY_HEADERS", True)
    ENABLE_HSTS = _bool("ENABLE_HSTS", True)
    # Never leak a stack trace to an API client in production.
    PROPAGATE_EXCEPTIONS = False


# Values that must never be used outside local development.
INSECURE_DEFAULTS = {
    "dev-only-insecure-secret-key",
    "dev-only-jwt-secret",
    "replace-with-a-long-random-value",
    "replace-with-a-different-long-random-value",
}

MIN_SECRET_LENGTH = 32


def validate_production_config(config):
    """Fail fast on a misconfigured production deployment.

    Returns a list of problems; the application factory raises on a non-empty
    list so a bad deploy never serves traffic with a known-public secret key.
    """
    problems = []

    for key in ("SECRET_KEY", "JWT_SECRET_KEY"):
        value = config.get(key) or ""
        if not value or value in INSECURE_DEFAULTS:
            problems.append(f"{key} is missing or still set to a development placeholder.")
        elif len(value) < MIN_SECRET_LENGTH:
            problems.append(
                f"{key} is only {len(value)} characters; use at least {MIN_SECRET_LENGTH}."
            )

    uri = config.get("SQLALCHEMY_DATABASE_URI") or ""
    if uri.startswith("sqlite") and not config.get("ALLOW_SQLITE_IN_PRODUCTION"):
        problems.append(
            "DATABASE_URL is not set, so the app would fall back to SQLite. Point it at "
            "PostgreSQL, or set ALLOW_SQLITE_IN_PRODUCTION=true if you really mean it."
        )

    if not config.get("CORS_ORIGINS"):
        problems.append("CORS_ORIGINS is empty; the browser frontend would be blocked.")

    return problems


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
