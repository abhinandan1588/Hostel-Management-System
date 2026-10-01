"""Date/time parsing helpers shared by services and routes."""

import calendar
from datetime import date, datetime, time, timedelta

from .errors import ValidationFailed


def parse_date(value, field="date", default=None, required=False):
    if value in (None, ""):
        if required:
            raise ValidationFailed(f"'{field}' is required", errors={field: ["This field is required."]})
        return default
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        raise ValidationFailed(
            f"'{field}' must be a valid date (YYYY-MM-DD)",
            errors={field: ["Expected format YYYY-MM-DD."]},
        )


def parse_time(value, field="time", default=None):
    if value in (None, ""):
        return default
    if isinstance(value, datetime):
        return value.time().replace(microsecond=0)
    if isinstance(value, time):
        return value.replace(microsecond=0)
    raw = str(value).strip().upper()
    fmts = ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M%p")
    for fmt in fmts:
        try:
            return datetime.strptime(raw, fmt).time().replace(microsecond=0)
        except ValueError:
            continue
    raise ValidationFailed(
        f"'{field}' must be a valid time (HH:MM)", errors={field: ["Expected format HH:MM."]}
    )


def parse_datetime(value, field="timestamp", default=None):
    if value in (None, ""):
        return default
    if isinstance(value, datetime):
        return value.replace(tzinfo=None, microsecond=0)
    raw = str(value).strip().replace("Z", "")
    try:
        return datetime.fromisoformat(raw).replace(tzinfo=None, microsecond=0)
    except ValueError:
        raise ValidationFailed(
            f"'{field}' must be a valid ISO timestamp", errors={field: ["Expected ISO 8601."]}
        )


def month_bounds(year, month):
    """First and last date of the given month."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def date_range(start, end):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def format_time_12h(value):
    if value is None:
        return None
    return value.strftime("%I:%M %p").lstrip("0")


def resolve_period(args, default_days=30):
    """Read ``start_date``/``end_date`` query params with a sensible default."""
    today = date.today()
    end = parse_date(args.get("end_date"), "end_date", default=today)
    start = parse_date(
        args.get("start_date"), "start_date", default=end - timedelta(days=default_days - 1)
    )
    if start > end:
        raise ValidationFailed("'start_date' must not be after 'end_date'")
    return start, end
