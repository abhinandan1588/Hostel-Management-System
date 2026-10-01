"""Uploaded media delivery and a health probe.

In production the ``PUBLIC_MEDIA_BASE_URL`` setting points clients at cloud
storage/CDN instead and this route is unused.
"""

from pathlib import Path

from flask import Blueprint, current_app, send_from_directory

from ..extensions import db
from ..utils.errors import NotFound
from ..utils.responses import success

media_bp = Blueprint("media", __name__, url_prefix="/api")


@media_bp.get("/media/<path:relative_path>")
def serve_media(relative_path):
    root = Path(current_app.config["UPLOAD_FOLDER"]).resolve()
    candidate = (root / relative_path).resolve()
    # Refuse any traversal outside the configured upload root.
    try:
        candidate.relative_to(root)
    except ValueError:
        raise NotFound("File not found")
    if not candidate.is_file():
        raise NotFound("File not found")
    response = send_from_directory(
        candidate.parent, candidate.name, max_age=60 * 60 * 24, conditional=True
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@media_bp.get("/healthz")
@media_bp.get("/status")
def health_check():
    """Liveness/readiness probe.

    Deliberately *not* at ``/api/health`` - that path belongs to student health
    records (see ``health_bp``).
    """
    from sqlalchemy import text

    database_ok = True
    try:
        db.session.execute(text("SELECT 1"))
    except Exception:
        database_ok = False
    return success(
        {
            "status": "ok" if database_ok else "degraded",
            "database": "up" if database_ok else "down",
            "environment": current_app.config.get("ENV_NAME", "unknown"),
        },
        message="Hostel Management System API",
    )


@media_bp.get("/meta")
def meta():
    """Enumerations the frontend needs to render dropdowns and badges."""
    from ..constants import (
        ActivityType,
        AnnouncementAudience,
        AttendanceSession,
        AttendanceStatus,
        EmergencyAlertType,
        EmergencyAudience,
        Gender,
        HealthSeverity,
        HealthStatus,
        MealType,
        NotificationPriority,
        NotificationType,
        RecoveryStatus,
        SchoolAttendanceStatus,
        StudentStatus,
        SuggestionCategory,
        SuggestionStatus,
        UserRole,
        VerificationStatus,
    )

    return success(
        {
            "roles": UserRole.values(),
            "genders": Gender.values(),
            "verification_statuses": VerificationStatus.values(),
            "attendance_statuses": AttendanceStatus.values(),
            "attendance_sessions": AttendanceSession.values(),
            "health_statuses": HealthStatus.values(),
            "health_severities": HealthSeverity.values(),
            "recovery_statuses": RecoveryStatus.values(),
            "meal_types": MealType.values(),
            "school_statuses": SchoolAttendanceStatus.values(),
            "student_statuses": StudentStatus.values(),
            "activity_types": ActivityType.values(),
            "notification_types": NotificationType.values(),
            "notification_priorities": NotificationPriority.values(),
            "announcement_audiences": AnnouncementAudience.values(),
            "suggestion_categories": SuggestionCategory.values(),
            "suggestion_statuses": SuggestionStatus.values(),
            "emergency_alert_types": EmergencyAlertType.values(),
            "emergency_audiences": EmergencyAudience.values(),
        }
    )
