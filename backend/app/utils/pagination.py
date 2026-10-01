"""Query pagination + sorting helpers."""

from flask import current_app, request


def get_pagination_args():
    default_size = current_app.config.get("DEFAULT_PAGE_SIZE", 20)
    max_size = current_app.config.get("MAX_PAGE_SIZE", 100)
    try:
        page = int(request.args.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(request.args.get("per_page", default_size))
    except (TypeError, ValueError):
        per_page = default_size
    page = max(page, 1)
    per_page = min(max(per_page, 1), max_size)
    return page, per_page


def paginate_query(query, page=None, per_page=None, serializer=None):
    """Run a paginated query and return ``(items, page, per_page, total)``."""
    if page is None or per_page is None:
        page, per_page = get_pagination_args()
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    items = pagination.items
    if serializer:
        items = [serializer(item) for item in items]
    return items, pagination.page, pagination.per_page, pagination.total


def apply_sort(query, model, allowed, default_column, default_desc=True):
    """Apply ``?sort_by=&sort_dir=`` using a whitelist of column names."""
    sort_by = (request.args.get("sort_by") or "").strip()
    sort_dir = (request.args.get("sort_dir") or "").strip().lower()
    column_name = sort_by if sort_by in allowed else default_column
    column = getattr(model, column_name, None)
    if column is None:
        return query
    descending = default_desc if sort_dir not in ("asc", "desc") else sort_dir == "desc"
    return query.order_by(column.desc() if descending else column.asc())
