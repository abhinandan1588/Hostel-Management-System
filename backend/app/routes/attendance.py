"""Attendance endpoints: /api/attendance/*

Official record: only ADMIN may write. Parents and students read their own
scope through ``authorize_student_access``.
"""

from datetime import date

from flask import Blueprint, request

from ..constants import AttendanceSession
from ..decorators import (
    accessible_student_ids,
    admin_required,
    auth_required,
    authorize_student_access,
    current_user,
)
from ..schemas import (
    AttendanceSchema,
    AttendanceUpdateSchema,
    BulkAttendanceSchema,
    load_payload,
)
from ..services import attendance_service
from ..utils.dates import parse_date, resolve_period
from ..utils.request_helpers import int_arg, json_body
from ..utils.responses import created, paginated, success

attendance_bp = Blueprint("attendance", __name__, url_prefix="/api/attendance")


@attendance_bp.get("")
@auth_required
def list_records():
    filters = {
        "student_id": request.args.get("student_id"),
        "date": parse_date(request.args.get("date"), "date", default=None),
        "start_date": parse_date(request.args.get("start_date"), "start_date", default=None),
        "end_date": parse_date(request.args.get("end_date"), "end_date", default=None),
        "status": request.args.get("status"),
        "session": request.args.get("session"),
        "student_class": request.args.get("student_class"),
    }
    restrict = accessible_student_ids()
    if filters["student_id"]:
        # Re-check ownership for the explicit single-student case.
        authorize_student_access(filters["student_id"], allow_inactive=True)
        restrict = None if current_user().is_admin else [int(filters["student_id"])]
    items, page, per_page, total = attendance_service.list_records(
        filters, restrict_ids=restrict
    )
    return paginated(items, page, per_page, total)


@attendance_bp.get("/sheet")
@admin_required
def daily_sheet():
    """Roll-call sheet for a given day: every active student, marked or not."""
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    session = AttendanceSession.coerce(request.args.get("session")) or AttendanceSession.MORNING
    return success(
        attendance_service.daily_sheet(on_date, session, request.args.get("student_class"))
    )


@attendance_bp.get("/today")
@admin_required
def today_counts():
    return success(attendance_service.today_counts())


@attendance_bp.get("/trend")
@admin_required
def trend():
    start, end = resolve_period(request.args, default_days=14)
    return success(attendance_service.daily_trend(start, end))


@attendance_bp.post("")
@admin_required
def record_attendance():
    payload = load_payload(AttendanceSchema, json_body())
    record = attendance_service.record_attendance(payload, actor=current_user())
    return created(record.to_dict(include_student=True), message="Attendance saved")


@attendance_bp.post("/bulk")
@admin_required
def bulk_record():
    payload = load_payload(BulkAttendanceSchema, json_body())
    records = attendance_service.bulk_record(payload, actor=current_user())
    return created(
        [record.to_dict() for record in records],
        message=f"Attendance saved for {len(records)} student(s)",
    )


@attendance_bp.patch("/<int:record_id>")
@admin_required
def update_record(record_id):
    record = attendance_service.get_record(record_id)
    payload = load_payload(AttendanceUpdateSchema, json_body(), partial=True)
    attendance_service.update_record(record, payload, actor=current_user())
    return success(record.to_dict(include_student=True), message="Attendance updated")


@attendance_bp.delete("/<int:record_id>")
@admin_required
def delete_record(record_id):
    record = attendance_service.get_record(record_id)
    attendance_service.delete_record(record, actor=current_user())
    return success(message="Attendance record deleted")


@attendance_bp.get("/<int:student_id>")
@auth_required
def student_records(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    start, end = resolve_period(request.args, default_days=30)
    filters = {"student_id": student.id, "start_date": start, "end_date": end}
    items, page, per_page, total = attendance_service.list_records(
        filters, restrict_ids=[student.id]
    )
    return paginated(
        items,
        page,
        per_page,
        total,
        extra={"summary": attendance_service.student_summary(student.id, start, end)},
    )


@attendance_bp.get("/<int:student_id>/summary")
@auth_required
def student_summary(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    start, end = resolve_period(request.args, default_days=30)
    return success(attendance_service.student_summary(student.id, start, end))


@attendance_bp.get("/<int:student_id>/calendar")
@auth_required
def student_calendar(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    today = date.today()
    year = int_arg("year", today.year)
    month = int_arg("month", today.month)
    return success(attendance_service.calendar(student.id, year, month))


@attendance_bp.get("/<int:student_id>/trend")
@auth_required
def student_trend(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    months = int_arg("months", 6)
    return success(attendance_service.monthly_trend(student.id, months=max(1, min(months, 24))))
