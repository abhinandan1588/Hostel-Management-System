"""Admin dashboard, settings, audit trail and administrator management."""

from flask import Blueprint, request

from ..decorators import admin_required, current_user, super_admin_required
from ..extensions import db
from ..models import AdminProfile
from ..schemas import AdminCreateSchema, AdminProfileUpdateSchema, load_payload
from ..services import auth_service, dashboard_service, progress_service, student_service
from ..utils.dates import parse_date
from ..utils.errors import ValidationFailed
from ..utils.request_helpers import json_body
from ..utils.responses import created, paginated, success
from ..utils.security import normalize_phone

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.get("/dashboard")
@admin_required
def dashboard():
    return success(dashboard_service.admin_dashboard())


@admin_bp.get("/summary")
@admin_required
def summary():
    return success(dashboard_service.admin_summary())


@admin_bp.get("/search")
@admin_required
def search():
    term = (request.args.get("q") or "").strip()
    if len(term) < 2:
        raise ValidationFailed("Enter at least 2 characters to search.")
    return success(dashboard_service.global_search(term))


@admin_bp.get("/audit-logs")
@admin_required
def audit_logs():
    filters = {
        "action": request.args.get("action"),
        "admin_id": request.args.get("admin_id"),
        "entity_type": request.args.get("entity_type"),
        "start_date": parse_date(request.args.get("start_date"), "start_date", default=None),
        "end_date": parse_date(request.args.get("end_date"), "end_date", default=None),
    }
    items, page, per_page, total = dashboard_service.audit_log_page(filters)
    return paginated(items, page, per_page, total)


@admin_bp.get("/profile")
@admin_required
def profile():
    user = current_user()
    return success({"user": user.to_dict(), "profile": user.admin_profile.to_dict() if user.admin_profile else None})


@admin_bp.patch("/profile")
@admin_required
def update_profile():
    user = current_user()
    payload = load_payload(AdminProfileUpdateSchema, json_body(), partial=True)
    if "full_name" in payload and payload["full_name"]:
        user.full_name = payload["full_name"]
    if "phone" in payload:
        user.phone = normalize_phone(payload["phone"])

    profile_row = user.admin_profile
    if profile_row is None:
        profile_row = AdminProfile(user_id=user.id)
        db.session.add(profile_row)
    for field in (
        "designation",
        "hostel_name",
        "notify_email",
        "notify_health_alerts",
        "notify_new_registrations",
        "notify_suggestions",
    ):
        if field in payload:
            setattr(profile_row, field, payload[field])
    db.session.commit()
    return success(
        {"user": user.to_dict(), "profile": profile_row.to_dict()}, message="Profile updated"
    )


@admin_bp.get("/settings")
@admin_required
def settings():
    """Reference data + counts used by the settings screen."""
    return success(
        {
            "user_counts": dashboard_service.user_counts_by_role(),
            "filter_options": student_service.filter_options(),
            "progress_categories": progress_service.list_categories(),
        }
    )


@admin_bp.get("/admins")
@admin_required
def list_admins():
    from ..constants import UserRole
    from ..models import User

    admins = User.query.filter(User.role == UserRole.ADMIN).order_by(User.full_name).all()
    return success(
        [
            {
                **admin.to_dict(),
                "designation": admin.admin_profile.designation if admin.admin_profile else None,
            }
            for admin in admins
        ]
    )


@admin_bp.post("/admins")
@super_admin_required
def create_admin():
    """Only a super administrator may create another administrator."""
    payload = load_payload(AdminCreateSchema, json_body())
    user = auth_service.create_admin(payload, actor=current_user())
    return created(user.to_dict(), message="Administrator account created")
