"""Business logic layer.

Flask routes stay thin: they validate input, call a service, and shape the HTTP
response. All domain rules, notifications and audit writes live here.
"""

__all__ = [
    "activity_service",
    "attendance_service",
    "auth_service",
    "communication_service",
    "dashboard_service",
    "health_service",
    "meal_service",
    "notification_service",
    "parent_service",
    "progress_service",
    "report_service",
    "room_service",
    "school_service",
    "student_service",
]
