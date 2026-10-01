"""Small helpers for reading request payloads and query parameters."""

from flask import request

from .errors import ValidationFailed

TRUTHY = {"1", "true", "yes", "on"}
FALSY = {"0", "false", "no", "off"}


def json_body(required=True):
    """Return the JSON body as a dict (also tolerates multipart form posts)."""
    if request.is_json:
        data = request.get_json(silent=True)
    elif request.form:
        data = request.form.to_dict()
    else:
        data = request.get_json(silent=True)
    if data is None:
        if required:
            raise ValidationFailed("A JSON request body is required.")
        return {}
    if not isinstance(data, dict):
        raise ValidationFailed("Request body must be a JSON object.")
    return data


def form_body():
    """Multipart form fields as a plain dict."""
    return request.form.to_dict()


def clean_str(value, max_length=None):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    if max_length:
        text = text[:max_length]
    return text


def to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    raw = str(value).strip().lower()
    if raw in TRUTHY:
        return True
    if raw in FALSY:
        return False
    return default


def bool_arg(name, default=False):
    return to_bool(request.args.get(name), default)


def int_arg(name, default=None):
    raw = request.args.get(name)
    if raw in (None, ""):
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ValidationFailed(f"'{name}' must be an integer.")


def to_decimal_or_none(value, field):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValidationFailed(f"'{field}' must be a number.", errors={field: ["Expected a number."]})


def str_list(value):
    """Accept a list or a newline/comma separated string and return a list."""
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value)
    separator = "\n" if "\n" in text else ","
    return [item.strip() for item in text.split(separator) if item.strip()]
