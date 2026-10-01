"""Blueprint registry."""

from .activities import activities_bp
from .admin import admin_bp
from .attendance import attendance_bp
from .auth import auth_bp
from .communication import (
    announcements_bp,
    emergency_bp,
    notifications_bp,
    suggestions_bp,
)
from .health import health_bp
from .meals import meals_bp
from .media import media_bp
from .parents import parents_bp
from .portal_parent import parent_portal_bp
from .portal_student import student_portal_bp
from .progress import progress_bp
from .reports import reports_bp
from .rooms import beds_bp, rooms_bp
from .school import school_bp
from .students import students_bp

ALL_BLUEPRINTS = (
    media_bp,
    auth_bp,
    admin_bp,
    students_bp,
    parents_bp,
    rooms_bp,
    beds_bp,
    attendance_bp,
    health_bp,
    meals_bp,
    school_bp,
    activities_bp,
    progress_bp,
    notifications_bp,
    suggestions_bp,
    announcements_bp,
    emergency_bp,
    reports_bp,
    parent_portal_bp,
    student_portal_bp,
)


def register_blueprints(app):
    for blueprint in ALL_BLUEPRINTS:
        app.register_blueprint(blueprint)


__all__ = ["register_blueprints", "ALL_BLUEPRINTS"]
