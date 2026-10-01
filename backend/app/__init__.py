"""Flask application factory for the Hostel Management System."""

import logging

from flask import jsonify

from .config import get_config
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
    _init_extensions(app)
    _register_jwt_handlers(app)
    register_error_handlers(app)
    _register_blueprints(app)
    _register_cli(app)
    _register_hooks(app)

    @app.get("/")
    def index():
        return jsonify(
            {
                "success": True,
                "message": "Hostel Management System API",
                "data": {
                    "version": __version__,
                    "docs": "See API_DOCUMENTATION.md",
                    "health": "/api/health",
                },
            }
        )

    return app


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

    ensure_upload_folder(app)
    app.extensions["hms_storage"] = LocalStorage(
        app.config["UPLOAD_FOLDER"], app.config.get("PUBLIC_MEDIA_BASE_URL", "")
    )

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


def _register_hooks(app):
    @app.after_request
    def _security_headers(response):
        if app.config.get("SEND_SECURE_HEADERS", True):
            apply_security_headers(response)
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
