"""Domain exceptions and the global error handler registry."""

import logging

from marshmallow import ValidationError as MarshmallowValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.exceptions import HTTPException

from .responses import error

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """Base class for expected, client-facing failures."""

    status_code = 400
    message = "Request could not be completed"

    def __init__(self, message=None, status_code=None, errors=None):
        super().__init__(message or self.message)
        if message:
            self.message = message
        if status_code:
            self.status_code = status_code
        self.errors = errors


class ValidationFailed(ApiError):
    status_code = 422
    message = "Validation failed"


class AuthenticationFailed(ApiError):
    status_code = 401
    message = "Invalid credentials"


class PermissionDenied(ApiError):
    status_code = 403
    message = "You do not have permission to access this resource"


class NotFound(ApiError):
    status_code = 404
    message = "Resource not found"


class Conflict(ApiError):
    status_code = 409
    message = "Resource already exists"


class BusinessRuleViolation(ApiError):
    status_code = 400
    message = "Operation not allowed"


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _handle_api_error(exc):
        return error(exc.message, exc.status_code, exc.errors)

    @app.errorhandler(MarshmallowValidationError)
    def _handle_marshmallow(exc):
        return error("Validation failed", 422, exc.messages)

    @app.errorhandler(IntegrityError)
    def _handle_integrity(exc):
        from ..extensions import db

        db.session.rollback()
        logger.warning("Integrity error: %s", exc)
        return error(
            "This action conflicts with existing data. Please check for duplicates.", 409
        )

    @app.errorhandler(SQLAlchemyError)
    def _handle_sqlalchemy(exc):
        from ..extensions import db

        db.session.rollback()
        logger.exception("Database error", exc_info=exc)
        return error("A database error occurred. Please try again.", 500)

    @app.errorhandler(HTTPException)
    def _handle_http(exc):
        if exc.code == 413:
            return error("Uploaded file is too large.", 413)
        return error(exc.description or exc.name, exc.code or 500)

    @app.errorhandler(Exception)
    def _handle_unexpected(exc):
        from ..extensions import db

        db.session.rollback()
        logger.exception("Unhandled exception", exc_info=exc)
        if app.config.get("DEBUG") or app.config.get("TESTING"):
            return error(f"{exc.__class__.__name__}: {exc}", 500)
        return error("Internal server error", 500)
