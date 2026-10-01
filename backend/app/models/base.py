"""Shared model helpers: UTC clock, timestamp mixin and enum column factory."""

from datetime import date, datetime, time, timezone
from decimal import Decimal

from ..extensions import db


def utcnow():
    """Naive UTC timestamp.

    Stored naive so behaviour is identical on SQLite (dev/tests) and
    PostgreSQL (production) and so comparisons never mix aware/naive values.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def enum_column(enum_cls, constraint_name, **kwargs):
    """A portable enum column (VARCHAR + CHECK constraint).

    Avoids native PostgreSQL enum types, which are painful to migrate.
    """
    return db.Column(
        db.Enum(
            enum_cls,
            name=constraint_name,
            native_enum=False,
            validate_strings=True,
            values_callable=lambda cls: [member.value for member in cls],
        ),
        **kwargs,
    )


def iso(value):
    """Serialise dates, times, datetimes and decimals for JSON output."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(microsecond=0).isoformat() + "Z"
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "value"):  # enum member
        return value.value
    return value


class TimestampMixin:
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    @property
    def timestamps(self):
        return {"created_at": iso(self.created_at), "updated_at": iso(self.updated_at)}
