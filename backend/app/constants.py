"""Domain enumerations shared by models, services and validation schemas.

All enums subclass ``str`` so they serialise straight to JSON and compare
cleanly against request payload strings.
"""

import enum


class BaseEnum(str, enum.Enum):
    def __str__(self):
        return self.value

    @classmethod
    def values(cls):
        return [member.value for member in cls]

    @classmethod
    def coerce(cls, value):
        """Return the matching member for ``value`` or ``None``.

        Accepts any casing / hyphenation so the API is forgiving of clients
        sending ``"present"`` or ``"went-to-school"``.
        """
        if value is None:
            return None
        if isinstance(value, cls):
            return value
        normalised = str(value).strip().upper().replace("-", "_").replace(" ", "_")
        for member in cls:
            if member.value.upper() == normalised or member.name == normalised:
                return member
        return None


class UserRole(BaseEnum):
    ADMIN = "ADMIN"
    PARENT = "PARENT"
    STUDENT = "STUDENT"


class AccountStatus(BaseEnum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"
    REJECTED = "REJECTED"
    INACTIVE = "INACTIVE"


class VerificationStatus(BaseEnum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class Gender(BaseEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class AttendanceStatus(BaseEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LEAVE = "LEAVE"
    LATE = "LATE"


class AttendanceSession(BaseEnum):
    MORNING = "MORNING"
    EVENING = "EVENING"
    NIGHT = "NIGHT"


class HealthStatus(BaseEnum):
    HEALTHY = "HEALTHY"
    FEELING_UNWELL = "FEELING_UNWELL"
    SICK = "SICK"
    MEDICAL_OBSERVATION = "MEDICAL_OBSERVATION"
    HOSPITALIZED = "HOSPITALIZED"


class HealthSeverity(BaseEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RecoveryStatus(BaseEnum):
    ONGOING = "ONGOING"
    RECOVERING = "RECOVERING"
    RECOVERED = "RECOVERED"


class MealType(BaseEnum):
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    EVENING_SNACK = "EVENING_SNACK"
    DINNER = "DINNER"


class SchoolAttendanceStatus(BaseEnum):
    WENT_TO_SCHOOL = "WENT_TO_SCHOOL"
    DID_NOT_GO = "DID_NOT_GO"
    ON_LEAVE = "ON_LEAVE"
    SCHOOL_HOLIDAY = "SCHOOL_HOLIDAY"
    RETURNED_FROM_SCHOOL = "RETURNED_FROM_SCHOOL"


class StudentStatus(BaseEnum):
    """Consent-based activity status. No hidden/continuous GPS tracking."""

    IN_HOSTEL = "IN_HOSTEL"
    AT_SCHOOL = "AT_SCHOOL"
    OUTSIDE_WITH_PERMISSION = "OUTSIDE_WITH_PERMISSION"
    ON_LEAVE = "ON_LEAVE"
    MEDICAL_FACILITY = "MEDICAL_FACILITY"
    RETURNED_TO_HOSTEL = "RETURNED_TO_HOSTEL"


class ActivityType(BaseEnum):
    WAKE_UP = "WAKE_UP"
    BREAKFAST = "BREAKFAST"
    LEFT_FOR_SCHOOL = "LEFT_FOR_SCHOOL"
    RETURNED_FROM_SCHOOL = "RETURNED_FROM_SCHOOL"
    LUNCH = "LUNCH"
    STUDY = "STUDY"
    OUTDOOR_ACTIVITY = "OUTDOOR_ACTIVITY"
    EVENING_SNACK = "EVENING_SNACK"
    DINNER = "DINNER"
    PRAYER = "PRAYER"
    LIGHTS_OUT = "LIGHTS_OUT"
    OTHER = "OTHER"


ACTIVITY_LABELS = {
    ActivityType.WAKE_UP: "Wake Up",
    ActivityType.BREAKFAST: "Breakfast",
    ActivityType.LEFT_FOR_SCHOOL: "Left for School",
    ActivityType.RETURNED_FROM_SCHOOL: "Returned to Hostel",
    ActivityType.LUNCH: "Lunch",
    ActivityType.STUDY: "Study Time",
    ActivityType.OUTDOOR_ACTIVITY: "Outdoor Activity",
    ActivityType.EVENING_SNACK: "Evening Snack",
    ActivityType.DINNER: "Dinner",
    ActivityType.PRAYER: "Prayer",
    ActivityType.LIGHTS_OUT: "Lights Out",
    ActivityType.OTHER: "Activity",
}


class NotificationType(BaseEnum):
    HEALTH_ALERT = "HEALTH_ALERT"
    ATTENDANCE_ALERT = "ATTENDANCE_ALERT"
    SCHOOL_STATUS = "SCHOOL_STATUS"
    PROGRESS_UPDATE = "PROGRESS_UPDATE"
    MEAL_UPDATE = "MEAL_UPDATE"
    ANNOUNCEMENT = "ANNOUNCEMENT"
    SUGGESTION_REPLY = "SUGGESTION_REPLY"
    ACCOUNT_VERIFICATION = "ACCOUNT_VERIFICATION"
    EMERGENCY_ALERT = "EMERGENCY_ALERT"
    ACTIVITY_UPDATE = "ACTIVITY_UPDATE"
    GENERAL = "GENERAL"


class NotificationPriority(BaseEnum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class AnnouncementAudience(BaseEnum):
    ALL_PARENTS = "ALL_PARENTS"
    ALL_STUDENTS = "ALL_STUDENTS"
    EVERYONE = "EVERYONE"
    SPECIFIC_STUDENT = "SPECIFIC_STUDENT"
    SPECIFIC_CLASS = "SPECIFIC_CLASS"


class SuggestionCategory(BaseEnum):
    FOOD = "FOOD"
    STUDY = "STUDY"
    HEALTH = "HEALTH"
    ROOM = "ROOM"
    DISCIPLINE = "DISCIPLINE"
    ACTIVITIES = "ACTIVITIES"
    SCHOOL = "SCHOOL"
    GENERAL = "GENERAL"
    OTHER = "OTHER"


class SuggestionStatus(BaseEnum):
    NEW = "NEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class SuggestionSource(BaseEnum):
    PARENT = "PARENT"
    STUDENT = "STUDENT"


class EmergencyAlertType(BaseEnum):
    MEDICAL_EMERGENCY = "MEDICAL_EMERGENCY"
    HOSTEL_EMERGENCY = "HOSTEL_EMERGENCY"
    SCHOOL_EMERGENCY = "SCHOOL_EMERGENCY"
    NATURAL_DISASTER = "NATURAL_DISASTER"
    IMPORTANT_ANNOUNCEMENT = "IMPORTANT_ANNOUNCEMENT"


class EmergencyAudience(BaseEnum):
    SINGLE_PARENT = "SINGLE_PARENT"
    SELECTED_PARENTS = "SELECTED_PARENTS"
    ALL_PARENTS = "ALL_PARENTS"


class AuditAction(BaseEnum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    PASSWORD_RESET = "PASSWORD_RESET"
    PARENT_REGISTERED = "PARENT_REGISTERED"
    PARENT_VERIFIED = "PARENT_VERIFIED"
    PARENT_REJECTED = "PARENT_REJECTED"
    PARENT_BLOCKED = "PARENT_BLOCKED"
    PARENT_UNBLOCKED = "PARENT_UNBLOCKED"
    PARENT_REMOVED = "PARENT_REMOVED"
    STUDENT_CREATED = "STUDENT_CREATED"
    STUDENT_UPDATED = "STUDENT_UPDATED"
    STUDENT_VERIFIED = "STUDENT_VERIFIED"
    STUDENT_BLOCKED = "STUDENT_BLOCKED"
    STUDENT_UNBLOCKED = "STUDENT_UNBLOCKED"
    STUDENT_REMOVED = "STUDENT_REMOVED"
    STUDENT_ACCOUNT_CREATED = "STUDENT_ACCOUNT_CREATED"
    PARENT_LINKED = "PARENT_LINKED"
    PARENT_UNLINKED = "PARENT_UNLINKED"
    BED_ASSIGNED = "BED_ASSIGNED"
    BED_RELEASED = "BED_RELEASED"
    ROOM_CREATED = "ROOM_CREATED"
    ROOM_UPDATED = "ROOM_UPDATED"
    ROOM_REMOVED = "ROOM_REMOVED"
    ATTENDANCE_RECORDED = "ATTENDANCE_RECORDED"
    ATTENDANCE_MODIFIED = "ATTENDANCE_MODIFIED"
    HEALTH_RECORD_CREATED = "HEALTH_RECORD_CREATED"
    HEALTH_RECORD_UPDATED = "HEALTH_RECORD_UPDATED"
    MEAL_UPLOADED = "MEAL_UPLOADED"
    MEAL_UPDATED = "MEAL_UPDATED"
    MEAL_REMOVED = "MEAL_REMOVED"
    SCHOOL_ATTENDANCE_RECORDED = "SCHOOL_ATTENDANCE_RECORDED"
    ACTIVITY_RECORDED = "ACTIVITY_RECORDED"
    ACTIVITY_UPDATED = "ACTIVITY_UPDATED"
    STATUS_CHANGED = "STATUS_CHANGED"
    PROGRESS_UPDATED = "PROGRESS_UPDATED"
    ACADEMIC_RECORD_CREATED = "ACADEMIC_RECORD_CREATED"
    ACADEMIC_RECORD_UPDATED = "ACADEMIC_RECORD_UPDATED"
    ANNOUNCEMENT_CREATED = "ANNOUNCEMENT_CREATED"
    ANNOUNCEMENT_UPDATED = "ANNOUNCEMENT_UPDATED"
    EMERGENCY_ALERT_SENT = "EMERGENCY_ALERT_SENT"
    SUGGESTION_UPDATED = "SUGGESTION_UPDATED"
    SUGGESTION_REPLIED = "SUGGESTION_REPLIED"
    ADMIN_CREATED = "ADMIN_CREATED"
    SETTINGS_UPDATED = "SETTINGS_UPDATED"
    REPORT_EXPORTED = "REPORT_EXPORTED"


# Default progress categories seeded on first run.
DEFAULT_PROGRESS_CATEGORIES = [
    ("Academic", "academic", "Overall academic performance"),
    ("Attendance", "attendance", "Hostel and school attendance consistency"),
    ("Discipline", "discipline", "Behaviour and adherence to hostel rules"),
    ("Health", "health", "General health and fitness"),
    ("Study Routine", "study-routine", "Consistency of daily study habits"),
    ("Sports", "sports", "Participation and performance in sports"),
    ("Activities", "activities", "Participation in extra-curricular activities"),
    ("Overall Progress", "overall-progress", "Aggregated overall progress"),
]

# Default hostel daily routine used when generating a day's activity plan.
DEFAULT_DAILY_ROUTINE = [
    (ActivityType.WAKE_UP, "Wake Up", "06:30"),
    (ActivityType.BREAKFAST, "Breakfast", "07:00"),
    (ActivityType.LEFT_FOR_SCHOOL, "Left for School", "07:30"),
    (ActivityType.RETURNED_FROM_SCHOOL, "Returned to Hostel", "14:15"),
    (ActivityType.LUNCH, "Lunch", "14:30"),
    (ActivityType.STUDY, "Study Time", "16:00"),
    (ActivityType.OUTDOOR_ACTIVITY, "Outdoor Activity", "18:00"),
    (ActivityType.DINNER, "Dinner", "20:00"),
    (ActivityType.STUDY, "Night Study", "21:00"),
    (ActivityType.LIGHTS_OUT, "Lights Out", "22:00"),
]
