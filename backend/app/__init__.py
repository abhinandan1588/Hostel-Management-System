"""Flask application factory for the Hostel Management System."""

import logging
import os

from flask import jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import get_config, validate_production_config
from .extensions import cors, db, jwt, limiter, mail, migrate
from .utils.errors import register_error_handlers
from .utils.security import apply_security_headers
from .utils.storage import LocalStorage, ensure_upload_folder

__version__ = "1.0.0"


def create_app(config_name=None):
    from flask import Flask

    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    _configure_logging(app)
    _verify_configuration(app)
    _apply_proxy_fix(app)
    _init_extensions(app)
    _register_jwt_handlers(app)
    register_error_handlers(app)
    _register_blueprints(app)
    _register_cli(app)
    _register_hooks(app)

    @app.get("/")
    @limiter.exempt
    def index():
        # Exempt from rate limiting: "/" is the default health check path on
        # most platforms, and probe traffic must never be throttled.
        return jsonify(
            {
                "success": True,
                "message": "Hostel Management System API",
                "data": {
                    "version": __version__,
                    "environment": app.config.get("ENV_NAME"),
                    "docs": "See API_DOCUMENTATION.md",
                    "health": "/api/healthz",
                },
            }
        )

    return app


def _verify_configuration(app):
    """Refuse to serve production traffic with an unsafe configuration."""
    if app.config.get("ENV_NAME") != "production":
        return
    problems = validate_production_config(app.config)
    if problems:
        bullets = "\n".join(f"  - {problem}" for problem in problems)
        raise RuntimeError(
            "Refusing to start: the production configuration is incomplete.\n"
            f"{bullets}\n"
            "Set the missing environment variables and redeploy."
        )


def _apply_proxy_fix(app):
    """Honour X-Forwarded-* headers when running behind a load balancer.

    Without this the client IP seen by the rate limiter is the proxy's, so every
    visitor would share a single bucket.
    """
    if not app.config.get("TRUST_PROXY_HEADERS"):
        return
    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=app.config.get("PROXY_FIX_FOR", 1),
        x_proto=app.config.get("PROXY_FIX_PROTO", 1),
        x_host=app.config.get("PROXY_FIX_HOST", 1),
        x_prefix=app.config.get("PROXY_FIX_PREFIX", 0),
    )


def _configure_logging(app):
    level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO
    logging.basicConfig(
        level=level, format="%(asctime)s %(levelname)s [%(name)s] %(message)s"
    )
    app.logger.setLevel(level)


def _init_extensions(app):
    db.init_app(app)
    migrate.init_app(app, db, render_as_batch=True)
    jwt.init_app(app)
    mail.init_app(app)

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        max_age=600,
    )

    limiter.init_app(app)
    if not app.config.get("RATELIMIT_ENABLED", True):
        limiter.enabled = False
    elif app.config.get("ENV_NAME") == "production" and app.config[
        "RATELIMIT_STORAGE_URI"
    ].startswith("memory://"):
        app.logger.warning(
            "Rate limits use in-memory storage, which is per worker process. "
            "Set REDIS_URL (or RATELIMIT_STORAGE_URI) so limits are shared."
        )

    upload_folder = ensure_upload_folder(app)
    app.extensions["hms_storage"] = LocalStorage(
        upload_folder, app.config.get("PUBLIC_MEDIA_BASE_URL", "")
    )
    _warn_about_ephemeral_uploads(app, upload_folder)

    # Importing the models package registers every table on db.metadata.
    with app.app_context():
        from . import models  # noqa: F401


def _register_blueprints(app):
    from .routes import register_blueprints

    register_blueprints(app)


def _register_jwt_handlers(app):
    from .services import auth_service

    @jwt.token_in_blocklist_loader
    def _check_revoked(jwt_header, jwt_payload):
        return auth_service.is_token_revoked(jwt_payload)

    @jwt.revoked_token_loader
    def _revoked(jwt_header, jwt_payload):
        return jsonify({"success": False, "message": "Session has been signed out."}), 401

    @jwt.expired_token_loader
    def _expired(jwt_header, jwt_payload):
        return (
            jsonify({"success": False, "message": "Session expired. Please sign in again."}),
            401,
        )

    @jwt.invalid_token_loader
    def _invalid(reason):
        return jsonify({"success": False, "message": "Invalid authentication token."}), 401

    @jwt.unauthorized_loader
    def _missing(reason):
        return jsonify({"success": False, "message": "Authentication required."}), 401

    @jwt.needs_fresh_token_loader
    def _needs_fresh(jwt_header, jwt_payload):
        return jsonify({"success": False, "message": "A fresh login is required."}), 401


def _warn_about_ephemeral_uploads(app, upload_folder):
    """Say so loudly when uploaded files will not survive a redeploy.

    PaaS containers have an ephemeral filesystem: without a mounted disk or an
    object-storage backend, meal and profile photos are lost on every deploy.
    """
    if app.config.get("ENV_NAME") != "production":
        return
    if app.config.get("STORAGE_BACKEND", "local") != "local":
        return
    if app.config.get("PUBLIC_MEDIA_BASE_URL"):
        return
    if os.getenv("UPLOADS_ARE_PERSISTENT", "").strip().lower() in {"1", "true", "yes"}:
        return
    app.logger.warning(
        "Uploads are written to the local filesystem at %s. On a platform with an "
        "ephemeral container filesystem these files are lost on every redeploy. "
        "Mount a persistent disk and point UPLOAD_FOLDER at it (then set "
        "UPLOADS_ARE_PERSISTENT=true), or switch to object storage.",
        upload_folder,
    )


def _register_hooks(app):
    @app.after_request
    def _security_headers(response):
        if app.config.get("SEND_SECURE_HEADERS", True):
            apply_security_headers(
                response,
                hsts=app.config.get("ENABLE_HSTS", False),
                hsts_max_age=app.config.get("HSTS_MAX_AGE", 31536000),
            )
        return response

    @app.teardown_appcontext
    def _remove_session(exception=None):
        if exception is not None:
            db.session.rollback()
        db.session.remove()


def _register_cli(app):
    """Management commands: ``flask init-data``, ``flask create-admin``, ``flask seed``."""
    import click

    @app.cli.command("init-data")
    def init_data():
        """Create tables (dev only) and seed the default progress categories."""
        from .services import progress_service

        db.create_all()
        created = progress_service.ensure_default_categories()
        click.echo(f"Database ready. {created} progress categories created.")

    @app.cli.command("create-admin")
    @click.option("--name", prompt="Full name")
    @click.option("--email", prompt="Email")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
    @click.option("--super/--no-super", "is_super", default=True)
    def create_admin(name, email, password, is_super):
        """Create an administrator account."""
        from .constants import UserRole
        from .models import User
        from .services import auth_service

        existing_admins = User.query.filter(User.role == UserRole.ADMIN).count()
        user = auth_service.create_admin(
            {
                "full_name": name,
                "email": email,
                "password": password,
                "is_super_admin": is_super,
            },
            is_first=existing_admins == 0,
        )
        click.echo(f"Administrator created: {user.email}")

    @app.cli.command("seed")
    @click.option("--reset/--no-reset", default=False, help="Drop and recreate all tables first.")
    def seed_command(reset):
        """Load development seed data."""
        from seed import run_seed

        run_seed(reset=reset)

    @app.cli.command("bootstrap-admin")
    def bootstrap_admin():
        """Create the first super administrator from environment variables.

        Idempotent: does nothing once any administrator exists, so it is safe to
        run on every deploy. Only administrators can create other
        administrators, so a fresh database needs this one-time seed.
        """
        from .constants import UserRole
        from .models import User
        from .services import auth_service

        email = (os.getenv("BOOTSTRAP_ADMIN_EMAIL") or "").strip()
        password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD") or ""
        name = (os.getenv("BOOTSTRAP_ADMIN_NAME") or "Hostel Administrator").strip()

        if not email or not password:
            click.echo("BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD not set - skipped.")
            return
        if User.query.filter(User.role == UserRole.ADMIN).count():
            click.echo("An administrator already exists - skipped.")
            return

        user = auth_service.create_admin(
            {
                "full_name": name,
                "email": email,
                "password": password,
                "designation": os.getenv("BOOTSTRAP_ADMIN_DESIGNATION") or "Chief Warden",
                "is_super_admin": True,
            },
            is_first=True,
        )
        click.echo(f"Created super administrator {user.email}. Change the password after signing in.")

    @app.cli.command("post-deploy")
    @click.pass_context
    def post_deploy(ctx):
        """Idempotent tasks to run after migrations on every deploy."""
        from .services import progress_service

        created = progress_service.ensure_default_categories()
        click.echo(f"Progress categories ready ({created} created).")
        ctx.invoke(bootstrap_admin)

    @app.cli.command("check-config")
    def check_config():
        """Report whether the current environment is production-ready."""
        from .config import validate_production_config

        problems = validate_production_config(app.config)
        click.echo(f"Environment: {app.config.get('ENV_NAME')}")
        click.echo(f"Database:    {_redact(app.config.get('SQLALCHEMY_DATABASE_URI'))}")
        click.echo(f"Rate limits: {app.config.get('RATELIMIT_STORAGE_URI')}")
        click.echo(f"Uploads:     {app.config.get('UPLOAD_FOLDER')}")
        click.echo(f"CORS:        {', '.join(app.config.get('CORS_ORIGINS') or []) or '(none)'}")
        if problems:
            click.echo("\nProblems that would block a production start:")
            for problem in problems:
                click.echo(f"  - {problem}")
            raise SystemExit(1)
        click.echo("\nNo production configuration problems found.")


def _redact(uri):
    """Hide the password in a database URI before logging it."""
    if not uri or "@" not in uri:
        return uri
    scheme, _, rest = uri.partition("://")
    credentials, _, host = rest.rpartition("@")
    user = credentials.split(":")[0] if credentials else ""
    return f"{scheme}://{user}:***@{host}"
