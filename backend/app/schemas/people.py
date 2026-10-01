"""Validation schemas for student, parent, admin and hostel management."""

from marshmallow import ValidationError, fields, validate, validates_schema

from ..constants import (
    Gender,
    StudentStatus,
    VerificationStatus,
)
from ..utils.security import PASSWORD_MIN_LENGTH
from .fields import BaseSchema, EnumField, TrimmedString


class StudentCreateSchema(BaseSchema):
    student_code = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=50))
    full_name = TrimmedString(required=True, validate=validate.Length(min=2, max=150))
    date_of_birth = fields.Date(required=False, allow_none=True)
    gender = EnumField(Gender, required=False, allow_none=True)
    blood_group = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=10))
    student_class = TrimmedString(required=True, validate=validate.Length(min=1, max=40))
    section = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=20))
    school_name = TrimmedString(required=True, validate=validate.Length(min=2, max=150))
    phone = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=25))
    email = fields.Email(required=False, allow_none=True)
    admission_date = fields.Date(required=False, allow_none=True)
    emergency_contact_name = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=150)
    )
    emergency_contact_phone = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=25)
    )
    emergency_contact_relation = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=50)
    )
    bed_id = fields.Integer(required=False, allow_none=True)
    notes = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=2000))
    verification_status = EnumField(VerificationStatus, required=False)
    parent_ids = fields.List(fields.Integer(), required=False)
    # Optional login account for students who own a phone.
    create_account = fields.Boolean(required=False, load_default=False)
    account_email = fields.Email(required=False, allow_none=True)
    account_password = fields.String(
        required=False, allow_none=True, validate=validate.Length(min=PASSWORD_MIN_LENGTH, max=128)
    )

    @validates_schema
    def _check_account(self, data, **kwargs):
        if data.get("create_account"):
            if not (data.get("account_email") or data.get("email")):
                raise ValidationError(
                    {"account_email": ["An email address is required to create a login account."]}
                )
            if not data.get("account_password"):
                raise ValidationError(
                    {"account_password": ["A password is required to create a login account."]}
                )


class StudentUpdateSchema(BaseSchema):
    full_name = TrimmedString(validate=validate.Length(min=2, max=150))
    date_of_birth = fields.Date(allow_none=True)
    gender = EnumField(Gender, allow_none=True)
    blood_group = TrimmedString(allow_none=True, validate=validate.Length(max=10))
    student_class = TrimmedString(validate=validate.Length(min=1, max=40))
    section = TrimmedString(allow_none=True, validate=validate.Length(max=20))
    school_name = TrimmedString(validate=validate.Length(min=2, max=150))
    phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    email = fields.Email(allow_none=True)
    admission_date = fields.Date(allow_none=True)
    emergency_contact_name = TrimmedString(allow_none=True, validate=validate.Length(max=150))
    emergency_contact_phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    emergency_contact_relation = TrimmedString(allow_none=True, validate=validate.Length(max=50))
    notes = TrimmedString(allow_none=True, validate=validate.Length(max=2000))


class StudentSelfUpdateSchema(BaseSchema):
    """Fields a student may change on their own profile."""

    phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    email = fields.Email(allow_none=True)
    blood_group = TrimmedString(allow_none=True, validate=validate.Length(max=10))
    emergency_contact_name = TrimmedString(allow_none=True, validate=validate.Length(max=150))
    emergency_contact_phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    emergency_contact_relation = TrimmedString(allow_none=True, validate=validate.Length(max=50))


class StudentAccountSchema(BaseSchema):
    email = fields.Email(required=True)
    password = fields.String(
        required=True, validate=validate.Length(min=PASSWORD_MIN_LENGTH, max=128), load_only=True
    )
    username = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=80))


class AssignParentSchema(BaseSchema):
    parent_id = fields.Integer(required=True)
    relationship_type = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=50)
    )
    is_primary = fields.Boolean(required=False, load_default=False)


class AssignBedSchema(BaseSchema):
    bed_id = fields.Integer(required=False, allow_none=True)


class StatusUpdateSchema(BaseSchema):
    status = EnumField(StudentStatus, required=True)
    remarks = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class ParentVerificationSchema(BaseSchema):
    reason = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class BlockSchema(BaseSchema):
    reason = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))


class ParentAdminUpdateSchema(BaseSchema):
    full_name = TrimmedString(validate=validate.Length(min=2, max=150))
    phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    address = TrimmedString(allow_none=True, validate=validate.Length(max=500))
    city = TrimmedString(allow_none=True, validate=validate.Length(max=80))
    relationship_to_student = TrimmedString(allow_none=True, validate=validate.Length(max=50))
    occupation = TrimmedString(allow_none=True, validate=validate.Length(max=100))
    alternate_phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))


class RoomSchema(BaseSchema):
    building = TrimmedString(required=False, validate=validate.Length(max=60))
    floor = fields.Integer(required=False, load_default=1, validate=validate.Range(min=0, max=100))
    room_number = TrimmedString(required=True, validate=validate.Length(min=1, max=30))
    capacity = fields.Integer(required=False, load_default=4, validate=validate.Range(min=1, max=50))
    room_type = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=40))
    notes = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=1000))
    is_active = fields.Boolean(required=False)
    # When creating: auto-create this many beds (defaults to capacity).
    bed_count = fields.Integer(required=False, allow_none=True, validate=validate.Range(min=0, max=50))


class BedSchema(BaseSchema):
    room_id = fields.Integer(required=True)
    bed_number = TrimmedString(required=True, validate=validate.Length(min=1, max=20))
    notes = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=255))
    is_active = fields.Boolean(required=False)


class AdminCreateSchema(BaseSchema):
    full_name = TrimmedString(required=True, validate=validate.Length(min=2, max=150))
    email = fields.Email(required=True)
    phone = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=25))
    password = fields.String(
        required=True, validate=validate.Length(min=PASSWORD_MIN_LENGTH, max=128), load_only=True
    )
    designation = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=100))
    is_super_admin = fields.Boolean(required=False, load_default=False)


class AdminProfileUpdateSchema(BaseSchema):
    full_name = TrimmedString(validate=validate.Length(min=2, max=150))
    phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    designation = TrimmedString(allow_none=True, validate=validate.Length(max=100))
    hostel_name = TrimmedString(allow_none=True, validate=validate.Length(max=150))
    notify_email = fields.Boolean()
    notify_health_alerts = fields.Boolean()
    notify_new_registrations = fields.Boolean()
    notify_suggestions = fields.Boolean()
