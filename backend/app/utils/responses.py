"""Consistent JSON envelope helpers.

Every endpoint returns either
``{"success": true,  "message": "...", "data": {...}}`` or
``{"success": false, "message": "...", "errors": {...}}``.
"""

from flask import jsonify


def success(data=None, message="OK", status_code=200, meta=None):
    payload = {"success": True, "message": message, "data": data if data is not None else {}}
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status_code


def created(data=None, message="Created successfully"):
    return success(data=data, message=message, status_code=201)


def error(message="Something went wrong", status_code=400, errors=None):
    payload = {"success": False, "message": message}
    if errors:
        payload["errors"] = errors
    return jsonify(payload), status_code


def paginated(items, page, per_page, total, message="OK", extra=None):
    total_pages = (total + per_page - 1) // per_page if per_page else 0
    meta = {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
    if extra:
        meta.update(extra)
    return success(data=items, message=message, meta=meta)
