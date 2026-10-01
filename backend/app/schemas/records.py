"""Validation schemas for daily records, progress and communication."""

from marshmallow import ValidationError, fields, validate, validates_schema

from ..constants import (
    ActivityType,
    AnnouncementAudience,
    AttendanceSession,
    AttendanceStatus,
    EmergencyAlertType,
    EmergencyAudience,
    HealthSeverity,
    HealthStatus,
    MealType,
    NotificationPriority,
    RecoveryStatus,
    SchoolAttendanceStatus,
    SuggestionCategory,
    SuggestionStatus,
)
from .fields import BaseSchema, EnumField, FlexibleTime, StringList, TrimmedString


# --------------------------------------------------------------------------
# Attendance
# --------------------------------------------------------------------------
class AttendanceSchema(BaseSchema):
    student_id = fields.Integer(required=True)
    date = fields.Date(required=False, allow_none=True)
    session = EnumField(AttendanceSession, required=False)
    status = EnumField(AttendanceStatus, required=True)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class AttendanceUpdateSchema(BaseSchema):
    status = EnumField(AttendanceStatus, required=False)
    session = EnumField(AttendanceSession, required=False)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class BulkAttendanceEntrySchema(BaseSchema):
    student_id = fields.Integer(required=True)
    status = EnumField(AttendanceStatus, required=True)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class BulkAttendanceSchema(BaseSchema):
    date = fields.Date(required=False, allow_none=True)
    session = EnumField(AttendanceSession, required=False)
    records = fields.List(
        fields.Nested(BulkAttendanceEntrySchema), required=True, validate=validate.Length(min=1)
    )


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
class HealthRecordSchema(BaseSchema):
    student_id = fields.Integer(required=True)
    status = EnumField(HealthStatus, required=True)
    severity = EnumField(HealthSeverity, required=False)
    symptoms = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))
    temperature = fields.Float(
        required=False, allow_none=True, validate=validate.Range(min=30, max=45)
    )
    description = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=2000))
    medicine_given = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=1000)
    )
    doctor_visited = fields.Boolean(required=False, load_default=False)
    doctor_name = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=150))
    hospital_visit = fields.Boolean(required=False, load_default=False)
    hospital_name = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=150))
    medical_remarks = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=2000)
    )
    recovery_status = EnumField(RecoveryStatus, required=False)
    recorded_at = fields.DateTime(required=False, allow_none=True)

    @validates_schema
    def _require_details_when_sick(self, data, **kwargs):
        status = data.get("status")
        if status and status != HealthStatus.HEALTHY:
            if not (data.get("symptoms") or data.get("description")):
                raise ValidationError(
                    {"symptoms": ["Describe the symptoms or add a description for a health issue."]}
                )


class HealthRecordUpdateSchema(HealthRecordSchema):
    student_id = fields.Integer(required=False)
    status = EnumField(HealthStatus, required=False)

    @validates_schema
    def _require_details_when_sick(self, data, **kwargs):  # relaxed for partial updates
        return None


# --------------------------------------------------------------------------
# Meals
# --------------------------------------------------------------------------
class MealSchema(BaseSchema):
    date = fields.Date(required=False, allow_none=True)
    meal_type = EnumField(MealType, required=True)
    name = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=120))
    food_items = StringList(required=False)
    served_at = FlexibleTime(required=False, allow_none=True)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class MealUpdateSchema(BaseSchema):
    name = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=120))
    food_items = StringList(required=False)
    served_at = FlexibleTime(required=False, allow_none=True)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


# --------------------------------------------------------------------------
# School attendance
# --------------------------------------------------------------------------
class SchoolAttendanceSchema(BaseSchema):
    student_id = fields.Integer(required=True)
    date = fields.Date(required=False, allow_none=True)
    status = EnumField(SchoolAttendanceStatus, required=True)
    departure_time = FlexibleTime(required=False, allow_none=True)
    expected_return_time = FlexibleTime(required=False, allow_none=True)
    actual_return_time = FlexibleTime(required=False, allow_none=True)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class SchoolAttendanceUpdateSchema(SchoolAttendanceSchema):
    student_id = fields.Integer(required=False)
    status = EnumField(SchoolAttendanceStatus, required=False)


# --------------------------------------------------------------------------
# Daily activities
# --------------------------------------------------------------------------
class ActivitySchema(BaseSchema):
    student_id = fields.Integer(required=True)
    date = fields.Date(required=False, allow_none=True)
    activity_type = EnumField(ActivityType, required=True)
    title = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=150))
    scheduled_time = FlexibleTime(required=False, allow_none=True)
    activity_time = FlexibleTime(required=False, allow_none=True)
    is_completed = fields.Boolean(required=False, load_default=False)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class ActivityUpdateSchema(BaseSchema):
    activity_type = EnumField(ActivityType, required=False)
    title = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=150))
    scheduled_time = FlexibleTime(required=False, allow_none=True)
    activity_time = FlexibleTime(required=False, allow_none=True)
    is_completed = fields.Boolean(required=False)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class GenerateRoutineSchema(BaseSchema):
    date = fields.Date(required=False, allow_none=True)
    student_ids = fields.List(fields.Integer(), required=False)
    overwrite = fields.Boolean(required=False, load_default=False)


# --------------------------------------------------------------------------
# Progress
# --------------------------------------------------------------------------
class AcademicRecordSchema(BaseSchema):
    student_id = fields.Integer(required=True)
    subject = TrimmedString(required=True, validate=validate.Length(min=1, max=80))
    exam_name = TrimmedString(required=True, validate=validate.Length(min=1, max=120))
    exam_type = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=60))
    marks_obtained = fields.Float(required=True, validate=validate.Range(min=0))
    max_marks = fields.Float(required=True, validate=validate.Range(min=0.01))
    teacher_remark = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=1000)
    )
    exam_date = fields.Date(required=False, allow_none=True)

    @validates_schema
    def _check_marks(self, data, **kwargs):
        obtained = data.get("marks_obtained")
        maximum = data.get("max_marks")
        if obtained is not None and maximum is not None and obtained > maximum:
            raise ValidationError(
                {"marks_obtained": ["Marks obtained cannot exceed the maximum marks."]}
            )


class AcademicRecordUpdateSchema(BaseSchema):
    subject = TrimmedString(validate=validate.Length(min=1, max=80))
    exam_name = TrimmedString(validate=validate.Length(min=1, max=120))
    exam_type = TrimmedString(allow_none=True, validate=validate.Length(max=60))
    marks_obtained = fields.Float(validate=validate.Range(min=0))
    max_marks = fields.Float(validate=validate.Range(min=0.01))
    teacher_remark = TrimmedString(allow_none=True, validate=validate.Length(max=1000))
    exam_date = fields.Date(allow_none=True)


class ProgressScoreEntrySchema(BaseSchema):
    """One category score. Used standalone and nested inside a bulk payload."""

    category_id = fields.Integer(required=False, allow_none=True)
    category_slug = TrimmedString(required=False, allow_none=True)
    score = fields.Float(required=True, validate=validate.Range(min=0, max=100))
    period_year = fields.Integer(required=False, validate=validate.Range(min=2000, max=2100))
    period_month = fields.Integer(required=False, validate=validate.Range(min=1, max=12))
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))

    @validates_schema
    def _need_category(self, data, **kwargs):
        if not data.get("category_id") and not data.get("category_slug"):
            raise ValidationError({"category_id": ["A progress category is required."]})


class ProgressRecordSchema(ProgressScoreEntrySchema):
    student_id = fields.Integer(required=True)


class BulkProgressSchema(BaseSchema):
    student_id = fields.Integer(required=True)
    period_year = fields.Integer(required=False, validate=validate.Range(min=2000, max=2100))
    period_month = fields.Integer(required=False, validate=validate.Range(min=1, max=12))
    scores = fields.List(
        fields.Nested(ProgressScoreEntrySchema), required=True, validate=validate.Length(min=1)
    )


# --------------------------------------------------------------------------
# Communication
# --------------------------------------------------------------------------
class SuggestionSchema(BaseSchema):
    subject = TrimmedString(required=True, validate=validate.Length(min=3, max=180))
    category = EnumField(SuggestionCategory, required=True)
    message = TrimmedString(required=True, validate=validate.Length(min=5, max=5000))
    student_id = fields.Integer(required=False, allow_none=True)


class SuggestionStatusSchema(BaseSchema):
    status = EnumField(SuggestionStatus, required=True)


class SuggestionReplySchema(BaseSchema):
    message = TrimmedString(required=True, validate=validate.Length(min=1, max=5000))


class AnnouncementSchema(BaseSchema):
    title = TrimmedString(required=True, validate=validate.Length(min=3, max=180))
    description = TrimmedString(required=True, validate=validate.Length(min=3, max=5000))
    audience = EnumField(AnnouncementAudience, required=True)
    target_student_id = fields.Integer(required=False, allow_none=True)
    target_class = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=40))
    start_date = fields.Date(required=False, allow_none=True)
    end_date = fields.Date(required=False, allow_none=True)
    is_active = fields.Boolean(required=False)

    @validates_schema
    def _check_target(self, data, **kwargs):
        audience = data.get("audience")
        if audience == AnnouncementAudience.SPECIFIC_STUDENT and not data.get("target_student_id"):
            raise ValidationError({"target_student_id": ["Select a student for this audience."]})
        if audience == AnnouncementAudience.SPECIFIC_CLASS and not data.get("target_class"):
            raise ValidationError({"target_class": ["Enter a class for this audience."]})
        start, end = data.get("start_date"), data.get("end_date")
        if start and end and end < start:
            raise ValidationError({"end_date": ["End date must be on or after the start date."]})


class EmergencyAlertSchema(BaseSchema):
    alert_type = EnumField(EmergencyAlertType, required=True)
    audience = EnumField(EmergencyAudience, required=True)
    title = TrimmedString(required=True, validate=validate.Length(min=3, max=180))
    message = TrimmedString(required=True, validate=validate.Length(min=5, max=5000))
    student_id = fields.Integer(required=False, allow_none=True)
    parent_ids = fields.List(fields.Integer(), required=False)

    @validates_schema
    def _check_audience(self, data, **kwargs):
        audience = data.get("audience")
        if audience == EmergencyAudience.SINGLE_PARENT and not data.get("student_id"):
            raise ValidationError(
                {"student_id": ["Select the student whose parents should be alerted."]}
            )
        if audience == EmergencyAudience.SELECTED_PARENTS and not data.get("parent_ids"):
            raise ValidationError({"parent_ids": ["Select at least one parent."]})


class NotificationBroadcastSchema(BaseSchema):
    title = TrimmedString(required=True, validate=validate.Length(min=3, max=150))
    message = TrimmedString(required=True, validate=validate.Length(min=3, max=5000))
    priority = EnumField(NotificationPriority, required=False)
    student_id = fields.Integer(required=False, allow_none=True)
    parent_ids = fields.List(fields.Integer(), required=False)
    audience = TrimmedString(required=False, allow_none=True)


class IssueReportSchema(BaseSchema):
    """A student-generated issue report (never an official record)."""

    subject = TrimmedString(required=True, validate=validate.Length(min=3, max=180))
    category = EnumField(SuggestionCategory, required=False)
    message = TrimmedString(required=True, validate=validate.Length(min=5, max=5000))
