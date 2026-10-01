"""Marshmallow request schemas.

``load_payload`` is the single entry point used by routes: it validates the
request body and raises :class:`ValidationFailed` (422) with field-level errors.
"""

from marshmallow import ValidationError

from ..utils.errors import ValidationFailed
from .auth import (
    ChangePasswordSchema,
    ForgotPasswordSchema,
    LoginSchema,
    ParentRegistrationSchema,
    ResetPasswordSchema,
    UpdateOwnProfileSchema,
)
from .fields import BaseSchema, EnumField, FlexibleTime, StringList, TrimmedString
from .people import (
    AdminCreateSchema,
    AdminProfileUpdateSchema,
    AssignBedSchema,
    AssignParentSchema,
    BedSchema,
    BlockSchema,
    ParentAdminUpdateSchema,
    ParentVerificationSchema,
    RoomSchema,
    StatusUpdateSchema,
    StudentAccountSchema,
    StudentCreateSchema,
    StudentSelfUpdateSchema,
    StudentUpdateSchema,
)
from .records import (
    AcademicRecordSchema,
    AcademicRecordUpdateSchema,
    ActivitySchema,
    ActivityUpdateSchema,
    AnnouncementSchema,
    AttendanceSchema,
    AttendanceUpdateSchema,
    BulkAttendanceSchema,
    BulkProgressSchema,
    EmergencyAlertSchema,
    GenerateRoutineSchema,
    HealthRecordSchema,
    HealthRecordUpdateSchema,
    IssueReportSchema,
    MealSchema,
    MealUpdateSchema,
    NotificationBroadcastSchema,
    ProgressRecordSchema,
    SchoolAttendanceSchema,
    SchoolAttendanceUpdateSchema,
    SuggestionReplySchema,
    SuggestionSchema,
    SuggestionStatusSchema,
)


def load_payload(schema, data, partial=False):
    """Validate ``data`` with ``schema`` and return the cleaned dict."""
    instance = schema() if isinstance(schema, type) else schema
    try:
        # Pass ``partial`` only when requested so a schema's own ``partial``
        # configuration (including nested schemas) is not overridden.
        if partial:
            return instance.load(data or {}, partial=partial)
        return instance.load(data or {})
    except ValidationError as exc:
        raise ValidationFailed("Please correct the highlighted fields.", errors=exc.messages)


__all__ = [
    "load_payload",
    "BaseSchema",
    "EnumField",
    "FlexibleTime",
    "StringList",
    "TrimmedString",
    "LoginSchema",
    "ParentRegistrationSchema",
    "ForgotPasswordSchema",
    "ResetPasswordSchema",
    "ChangePasswordSchema",
    "UpdateOwnProfileSchema",
    "StudentCreateSchema",
    "StudentUpdateSchema",
    "StudentSelfUpdateSchema",
    "StudentAccountSchema",
    "AssignParentSchema",
    "AssignBedSchema",
    "StatusUpdateSchema",
    "ParentVerificationSchema",
    "ParentAdminUpdateSchema",
    "BlockSchema",
    "RoomSchema",
    "BedSchema",
    "AdminCreateSchema",
    "AdminProfileUpdateSchema",
    "AttendanceSchema",
    "AttendanceUpdateSchema",
    "BulkAttendanceSchema",
    "HealthRecordSchema",
    "HealthRecordUpdateSchema",
    "MealSchema",
    "MealUpdateSchema",
    "SchoolAttendanceSchema",
    "SchoolAttendanceUpdateSchema",
    "ActivitySchema",
    "ActivityUpdateSchema",
    "GenerateRoutineSchema",
    "AcademicRecordSchema",
    "AcademicRecordUpdateSchema",
    "ProgressRecordSchema",
    "BulkProgressSchema",
    "SuggestionSchema",
    "SuggestionStatusSchema",
    "SuggestionReplySchema",
    "AnnouncementSchema",
    "EmergencyAlertSchema",
    "NotificationBroadcastSchema",
    "IssueReportSchema",
]
