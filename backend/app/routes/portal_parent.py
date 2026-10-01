"""Parent portal endpoints: /api/parent/*

Every route is scoped to the authenticated, admin-verified parent. Child ids are
re-checked against the parent's own links on each request.
"""

from datetime import date

from flask import Blueprint, request

from ..decorators import current_parent, current_user, parent_required
from ..services import (
    activity_service,
    attendance_service,
    communication_service,
    dashboard_service,
    health_service,
    meal_service,
    notification_service,
    parent_service,
    progress_service,
    school_service,
    student_service,
)
from ..utils.dates import parse_date, resolve_period
from ..utils.request_helpers import int_arg
from ..utils.responses import paginated, success

parent_portal_bp = Blueprint("parent_portal", __name__, url_prefix="/api/parent")


def _child(student_id):
    """Resolve a child id, refusing anything not linked to this parent."""
    return parent_service.ensure_child_access(current_parent(), student_id)


@parent_portal_bp.get("/dashboard")
@parent_required(verified=True)
def dashboard():
    return success(
        dashboard_service.parent_dashboard(current_parent(), request.args.get("student_id"))
    )


@parent_portal_bp.get("/children")
@parent_required(verified=True)
def children():
    return success(parent_service.children_payload(current_parent()))


@parent_portal_bp.get("/children/<int:student_id>")
@parent_required(verified=True)
def child_profile(student_id):
    student = _child(student_id)
    today = date.today()
    return success(
        {
            "student": student.to_dict(),
            "health": health_service.current_status(student.id),
            "school_today": school_service.status_for_date(student.id, today),
            "attendance_month": attendance_service.monthly_summary(
                student.id, today.year, today.month
            ),
            "progress": progress_service.current_progress(student.id),
            "timeline": activity_service.timeline(student.id, today),
            "status_history": student_service.status_timeline(student, limit=10),
        }
    )


@parent_portal_bp.get("/children/<int:student_id>/today")
@parent_required(verified=True)
def child_today(student_id):
    student = _child(student_id)
    return success(dashboard_service.child_today_snapshot(student))


@parent_portal_bp.get("/children/<int:student_id>/daily-activity")
@parent_required(verified=True)
def child_daily_activity(student_id):
    student = _child(student_id)
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    return success(
        {
            "date": on_date.isoformat(),
            "timeline": activity_service.timeline(student.id, on_date),
            "school": school_service.status_for_date(student.id, on_date),
            "meals": meal_service.day_menu(on_date),
            "health": health_service.records_for_date(student.id, on_date),
            "attendance": [
                record.to_dict()
                for record in student.attendance_records
                if record.date == on_date
            ],
        }
    )


@parent_portal_bp.get("/children/<int:student_id>/attendance")
@parent_required(verified=True)
def child_attendance(student_id):
    student = _child(student_id)
    today = date.today()
    year = int_arg("year", today.year)
    month = int_arg("month", today.month)
    start, end = resolve_period(request.args, default_days=30)
    records, page, per_page, total = attendance_service.list_records(
        {"student_id": student.id, "start_date": start, "end_date": end},
        restrict_ids=[student.id],
    )
    return paginated(
        records,
        page,
        per_page,
        total,
        extra={
            "calendar": attendance_service.calendar(student.id, year, month),
            "monthly_trend": attendance_service.monthly_trend(student.id, months=6),
        },
    )


@parent_portal_bp.get("/children/<int:student_id>/health")
@parent_required(verified=True)
def child_health(student_id):
    student = _child(student_id)
    return success(
        {
            "current": health_service.current_status(student.id),
            "timeline": health_service.timeline(student.id),
        }
    )


@parent_portal_bp.get("/children/<int:student_id>/meals")
@parent_required(verified=True)
def child_meals(student_id):
    _child(student_id)
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    start, end = resolve_period(request.args, default_days=7)
    return success(
        {
            "today": meal_service.day_menu(on_date),
            "history": meal_service.list_meals(start, end),
        }
    )


@parent_portal_bp.get("/children/<int:student_id>/school")
@parent_required(verified=True)
def child_school(student_id):
    student = _child(student_id)
    start, end = resolve_period(request.args, default_days=30)
    records, page, per_page, total = school_service.list_records(
        {"student_id": student.id, "start_date": start, "end_date": end},
        restrict_ids=[student.id],
    )
    return paginated(
        records,
        page,
        per_page,
        total,
        extra={"today": school_service.status_for_date(student.id, date.today())},
    )


@parent_portal_bp.get("/children/<int:student_id>/progress")
@parent_required(verified=True)
def child_progress(student_id):
    student = _child(student_id)
    return success(progress_service.overview(student.id))


@parent_portal_bp.get("/children/<int:student_id>/academic")
@parent_required(verified=True)
def child_academic(student_id):
    student = _child(student_id)
    items, page, per_page, total = progress_service.list_academic_records(
        {"student_id": student.id}, restrict_ids=[student.id]
    )
    return paginated(
        items,
        page,
        per_page,
        total,
        extra={"subjects": progress_service.subject_averages(student.id)},
    )


@parent_portal_bp.get("/profile")
@parent_required(verified=False)
def profile():
    parent = current_parent()
    return success(
        {
            "user": current_user().to_dict(),
            "parent": parent.to_dict(include_children=True, include_documents=True),
        }
    )


@parent_portal_bp.get("/notifications")
@parent_required(verified=False)
def notifications():
    items, page, per_page, total = notification_service.list_notifications(current_user())
    return paginated(
        items,
        page,
        per_page,
        total,
        extra={
            "unread_count": notification_service.unread_count(current_user()),
            "emergency_alerts": communication_service.active_alerts_for_user(current_user()),
        },
    )


@parent_portal_bp.get("/announcements")
@parent_required(verified=False)
def announcements():
    return success(communication_service.announcements_for_user(current_user(), limit=50))


@parent_portal_bp.get("/status")
@parent_required(verified=False)
def verification_status():
    """Available to unverified parents so the UI can show pending state."""
    parent = current_parent()
    return success(
        {
            "verification_status": parent.verification_status.value,
            "account_status": current_user().account_status.value,
            "rejection_reason": parent.rejection_reason,
            "children_linked": len(parent.student_links),
            "claimed_student_code": parent.claimed_student_code,
        }
    )
