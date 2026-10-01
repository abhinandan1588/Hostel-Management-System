"""Request validation schemas for authentication endpoints."""

from marshmallow import ValidationError, fields, validate, validates_schema

from ..utils.security import PASSWORD_MIN_LENGTH, is_valid_phone
from .fields import BaseSchema, TrimmedString


def _password_field(**kwargs):
    return fields.String(
        required=True,
        validate=validate.Length(min=PASSWORD_MIN_LENGTH, max=128),
        load_only=True,
        **kwargs,
    )


class PhoneMixin:
    @validates_schema
    def _check_phone(self, data, **kwargs):
        phone = data.get("phone")
        if phone and not is_valid_phone(phone):
            raise ValidationError({"phone": ["Enter a valid phone number."]})


class LoginSchema(BaseSchema):
    # Accepts an email, username or phone number.
    identifier = TrimmedString(required=True, validate=validate.Length(min=3, max=255))
    password = fields.String(required=True, load_only=True)


class ParentRegistrationSchema(PhoneMixin, BaseSchema):
    full_name = TrimmedString(required=True, validate=validate.Length(min=2, max=150))
    email = fields.Email(required=True)
    phone = TrimmedString(required=True, validate=validate.Length(min=7, max=25))
    password = _password_field()
    confirm_password = fields.String(required=False, load_only=True)
    address = TrimmedString(required=True, validate=validate.Length(min=5, max=500))
    city = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=80))
    relationship_to_student = TrimmedString(
        required=True, validate=validate.Length(min=2, max=50)
    )
    occupation = TrimmedString(required=False, allow_none=True, validate=validate.Length(max=100))
    alternate_phone = TrimmedString(
        required=False, allow_none=True, validate=validate.Length(max=25)
    )
    student_code = TrimmedString(required=True, validate=validate.Length(min=2, max=50))

    @validates_schema
    def _check_confirm(self, data, **kwargs):
        confirm = data.get("confirm_password")
        if confirm is not None and confirm != data.get("password"):
            raise ValidationError({"confirm_password": ["Passwords do not match."]})


class ForgotPasswordSchema(BaseSchema):
    email = fields.Email(required=True)


class ResetPasswordSchema(BaseSchema):
    token = TrimmedString(required=True, validate=validate.Length(min=10, max=255))
    password = _password_field()
    confirm_password = fields.String(required=False, load_only=True)

    @validates_schema
    def _check_confirm(self, data, **kwargs):
        confirm = data.get("confirm_password")
        if confirm is not None and confirm != data.get("password"):
            raise ValidationError({"confirm_password": ["Passwords do not match."]})


class ChangePasswordSchema(BaseSchema):
    current_password = fields.String(required=True, load_only=True)
    new_password = _password_field(data_key="new_password")
    confirm_password = fields.String(required=False, load_only=True)

    @validates_schema
    def _check_confirm(self, data, **kwargs):
        confirm = data.get("confirm_password")
        if confirm is not None and confirm != data.get("new_password"):
            raise ValidationError({"confirm_password": ["Passwords do not match."]})


class UpdateOwnProfileSchema(PhoneMixin, BaseSchema):
    full_name = TrimmedString(validate=validate.Length(min=2, max=150))
    phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    address = TrimmedString(allow_none=True, validate=validate.Length(max=500))
    city = TrimmedString(allow_none=True, validate=validate.Length(max=80))
    occupation = TrimmedString(allow_none=True, validate=validate.Length(max=100))
    alternate_phone = TrimmedString(allow_none=True, validate=validate.Length(max=25))
    notify_email = fields.Boolean()
