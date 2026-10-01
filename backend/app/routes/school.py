"""School attendance endpoints: /api/school-attendance/*"""

from datetime import date

from flask import Blueprint, request

from ..decorators import (
    accessible_student_ids,
    admin_required,
    auth_required,
    authorize_student_access,
    current_user,
)
from ..schemas import SchoolAttendanceSchema, SchoolAttendanceUpdateSchema, load_payload
from ..services import school_service
from ..utils.dates import parse_date, parse_time, resolve_period
from ..utils.request_helpers import json_body
from ..utils.responses import created, paginated, success

school_bp = Blueprint("school", __name__, url_prefix="/api/school-attendance")


@school_bp.get("")
@auth_required
def list_records():
    filters = {
        "student_id": request.args.get("student_id"),
        "date": parse_date(request.args.get("date"), "date", default=None),
        "start_date": parse_date(request.args.get("start_date"), "start_date", default=None),
        "end_date": parse_date(request.args.get("end_date"), "end_date", default=None),
        "status": request.args.get("status"),
        "student_class": request.args.get("student_class"),
    }
    restrict = accessible_student_ids()
    if filters["student_id"]:
        authorize_student_access(filters["student_id"], allow_inactive=True)
        restrict = None if current_user().is_admin else [int(filters["student_id"])]
    items, page, per_page, total = school_service.list_records(filters, restrict_ids=restrict)
    return paginated(items, page, per_page, total)


@school_bp.get("/sheet")
@admin_required
def daily_sheet():
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    return success(school_service.daily_sheet(on_date, request.args.get("student_class")))


@school_bp.get("/weekly")
@admin_required
def weekly():
    start, end = resolve_period(request.args, default_days=7)
    return success(school_service.weekly_counts(start, end))


@school_bp.post("")
@admin_required
def record():
    payload = load_payload(SchoolAttendanceSchema, json_body())
    entry = school_service.record_school_attendance(payload, actor=current_user())
    return created(entry.to_dict(include_student=True), message="School status saved")


@school_bp.patch("/<int:record_id>")
@admin_required
def update_record(record_id):
    entry = school_service.get_record(record_id)
    payload = load_payload(SchoolAttendanceUpdateSchema, json_body(), partial=True)
    school_service.update_record(entry, payload, actor=current_user())
    return success(entry.to_dict(include_student=True), message="School status updated")


@school_bp.post("/<int:record_id>/returned")
@admin_required
def mark_returned(record_id):
    entry = school_service.get_record(record_id)
    body = json_body(required=False)
    return_time = parse_time(body.get("actual_return_time"), "actual_return_time", default=None)
    school_service.mark_returned(entry, return_time, actor=current_user())
    return success(
        entry.to_dict(include_student=True), message="Marked as returned from school"
    )


@school_bp.delete("/<int:record_id>")
@admin_required
def delete_record(record_id):
    entry = school_service.get_record(record_id)
    school_service.delete_record(entry, actor=current_user())
    return success(message="School attendance record deleted")


@school_bp.get("/student/<int:student_id>")
@auth_required
def student_records(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    start, end = resolve_period(request.args, default_days=30)
    filters = {"student_id": student.id, "start_date": start, "end_date": end}
    items, page, per_page, total = school_service.list_records(
        filters, restrict_ids=[student.id]
    )
    return paginated(
        items,
        page,
        per_page,
        total,
        extra={"today": school_service.status_for_date(student.id, date.today())},
    )


@school_bp.get("/student/<int:student_id>/today")
@auth_required
def student_today(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    return success(school_service.status_for_date(student.id, on_date))
