"""Student portal endpoints: /api/student/*

Students can read their own records and confirm activities. They can never
modify attendance, health, school attendance, academic marks or progress -
those routes live behind ``@admin_required`` in their own blueprints.
"""

from datetime import date

from flask import Blueprint, request

from ..decorators import current_student, current_user, student_required
from ..extensions import db
from ..schemas import StudentSelfUpdateSchema, load_payload
from ..services import (
    activity_service,
    attendance_service,
    communication_service,
    dashboard_service,
    health_service,
    meal_service,
    notification_service,
    progress_service,
    school_service,
)
from ..utils.dates import parse_date, resolve_period
from ..utils.request_helpers import int_arg, json_body
from ..utils.responses import created, paginated, success
from ..utils.security import normalize_phone
from .communication import create_issue_report

student_portal_bp = Blueprint("student_portal", __name__, url_prefix="/api/student")


@student_portal_bp.get("/dashboard")
@student_required
def dashboard():
    return success(dashboard_service.student_dashboard(current_student()))


@student_portal_bp.get("/profile")
@student_required
def profile():
    student = current_student()
    return success(
        {
            "user": current_user().to_dict(),
            "student": student.to_dict(include_parents=True),
            "editable_fields": [
                "phone",
                "email",
                "blood_group",
                "emergency_contact_name",
                "emergency_contact_phone",
                "emergency_contact_relation",
            ],
        }
    )


@student_portal_bp.patch("/profile")
@student_required
def update_profile():
    """Only the small whitelist of non-official fields may be self-edited."""
    student = current_student()
    payload = load_payload(StudentSelfUpdateSchema, json_body(), partial=True)
    for field in ("email", "blood_group", "emergency_contact_name", "emergency_contact_relation"):
        if field in payload:
            setattr(student, field, payload[field])
    if "phone" in payload:
        student.phone = normalize_phone(payload["phone"])
    if "emergency_contact_phone" in payload:
        student.emergency_contact_phone = normalize_phone(payload["emergency_contact_phone"])
    db.session.commit()
    return success(student.to_dict(include_parents=False), message="Profile updated")


@student_portal_bp.get("/routine")
@student_required
def routine():
    student = current_student()
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    return success(
        {
            "date": on_date.isoformat(),
            "timeline": activity_service.timeline(student.id, on_date),
            "school": school_service.status_for_date(student.id, on_date),
            "meals": meal_service.day_menu(on_date),
        }
    )


@student_portal_bp.get("/attendance")
@student_required
def attendance():
    student = current_student()
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
            "summary": attendance_service.monthly_summary(student.id, year, month),
        },
    )


@student_portal_bp.get("/school")
@student_required
def school():
    student = current_student()
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


@student_portal_bp.get("/health")
@student_required
def health():
    student = current_student()
    return success(
        {
            "current": health_service.current_status(student.id),
            "timeline": health_service.timeline(student.id),
        }
    )


@student_portal_bp.get("/meals")
@student_required
def meals():
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    start, end = resolve_period(request.args, default_days=7)
    return success(
        {"today": meal_service.day_menu(on_date), "history": meal_service.list_meals(start, end)}
    )


@student_portal_bp.get("/progress")
@student_required
def progress():
    student = current_student()
    return success(progress_service.overview(student.id))


@student_portal_bp.get("/notifications")
@student_required
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


@student_portal_bp.get("/announcements")
@student_required
def announcements():
    return success(communication_service.announcements_for_user(current_user(), limit=50))


@student_portal_bp.post("/report-issue")
@student_required
def report_issue():
    """Student-generated issue report - stored as feedback, not an official record."""
    suggestion = create_issue_report(current_user())
    return created(suggestion.to_dict(), message="Your report has been sent to the warden")
