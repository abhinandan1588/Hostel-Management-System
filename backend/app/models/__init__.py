"""SQLAlchemy models.

Importing this package registers every table on the shared ``db.metadata`` so
Flask-Migrate can autogenerate migrations.
"""

from .base import TimestampMixin, iso, utcnow
from .communication import (
    Announcement,
    EmergencyAlert,
    EmergencyAlertRecipient,
    Notification,
    Suggestion,
    SuggestionReply,
)
from .daily import (
    AttendanceRecord,
    DailyActivity,
    HealthRecord,
    Meal,
    MealPhoto,
    SchoolAttendance,
)
from .hostel import Bed, Room
from .parent import Parent, StudentParent
from .progress import AcademicProgress, ProgressCategory, ProgressRecord
from .student import Student, StudentStatusHistory
from .user import AdminProfile, AuditLog, PasswordResetToken, TokenBlocklist, User

__all__ = [
    "TimestampMixin",
    "iso",
    "utcnow",
    "User",
    "AdminProfile",
    "AuditLog",
    "PasswordResetToken",
    "TokenBlocklist",
    "Parent",
    "StudentParent",
    "Student",
    "StudentStatusHistory",
    "Room",
    "Bed",
    "AttendanceRecord",
    "HealthRecord",
    "Meal",
    "MealPhoto",
    "SchoolAttendance",
    "DailyActivity",
    "AcademicProgress",
    "ProgressCategory",
    "ProgressRecord",
    "Notification",
    "Announcement",
    "Suggestion",
    "SuggestionReply",
    "EmergencyAlert",
    "EmergencyAlertRecipient",
]
