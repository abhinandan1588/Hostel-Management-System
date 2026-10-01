"""Custom marshmallow fields and the shared base schema."""

from marshmallow import EXCLUDE, Schema, fields


class BaseSchema(Schema):
    class Meta:
        unknown = EXCLUDE


class EnumField(fields.Field):
    """Case/format tolerant enum field built on ``BaseEnum.coerce``."""

    default_error_messages = {"invalid": "Must be one of: {choices}."}

    def __init__(self, enum_cls, **kwargs):
        self.enum_cls = enum_cls
        super().__init__(**kwargs)

    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        return getattr(value, "value", value)

    def _deserialize(self, value, attr, data, **kwargs):
        member = self.enum_cls.coerce(value)
        if member is None:
            raise self.make_error("invalid", choices=", ".join(self.enum_cls.values()))
        return member


class TrimmedString(fields.String):
    """String field that strips whitespace and turns "" into ``None``."""

    def _deserialize(self, value, attr, data, **kwargs):
        result = super()._deserialize(value, attr, data, **kwargs)
        if result is None:
            return None
        result = result.strip()
        return result or None


class FlexibleTime(fields.Field):
    """Accepts ``HH:MM``, ``HH:MM:SS`` and ``hh:mm AM/PM``."""

    default_error_messages = {"invalid": "Not a valid time (use HH:MM)."}

    def _serialize(self, value, attr, obj, **kwargs):
        return value.isoformat() if value else None

    def _deserialize(self, value, attr, data, **kwargs):
        from ..utils.dates import parse_time
        from ..utils.errors import ValidationFailed

        if value in (None, ""):
            return None
        try:
            return parse_time(value, field=attr or "time")
        except ValidationFailed:
            raise self.make_error("invalid")


class StringList(fields.Field):
    """Accepts a JSON array or a newline/comma separated string."""

    def _serialize(self, value, attr, obj, **kwargs):
        return value or []

    def _deserialize(self, value, attr, data, **kwargs):
        from ..utils.request_helpers import str_list

        return str_list(value)
