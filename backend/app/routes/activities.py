"""Daily activity timeline endpoints: /api/activities/*"""

from datetime import date

from flask import Blueprint, request

from ..decorators import (
    accessible_student_ids,
    admin_required,
    auth_required,
    authorize_student_access,
    current_student,
    current_user,
    student_required,
)
from ..schemas import ActivitySchema, ActivityUpdateSchema, GenerateRoutineSchema, load_payload
from ..services import activity_service
from ..utils.dates import parse_date, parse_time, resolve_period
from ..utils.request_helpers import bool_arg, json_body
from ..utils.responses import created, paginated, success

activities_bp = Blueprint("activities", __name__, url_prefix="/api/activities")


@activities_bp.get("")
@auth_required
def list_activities():
    filters = {
        "student_id": request.args.get("student_id"),
        "date": parse_date(request.args.get("date"), "date", default=None),
        "start_date": parse_date(request.args.get("start_date"), "start_date", default=None),
        "end_date": parse_date(request.args.get("end_date"), "end_date", default=None),
        "activity_type": request.args.get("activity_type"),
        "completed_only": bool_arg("completed_only"),
    }
    restrict = accessible_student_ids()
    if filters["student_id"]:
        authorize_student_access(filters["student_id"], allow_inactive=True)
        restrict = None if current_user().is_admin else [int(filters["student_id"])]
    items, page, per_page, total = activity_service.list_activities(
        filters, restrict_ids=restrict
    )
    return paginated(items, page, per_page, total)


@activities_bp.get("/stats")
@admin_required
def stats():
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    return success(activity_service.completion_stats(on_date))


@activities_bp.get("/recent")
@admin_required
def recent():
    return success(activity_service.recent_hostel_activity(limit=20))


@activities_bp.post("")
@admin_required
def create_activity():
    payload = load_payload(ActivitySchema, json_body())
    activity = activity_service.create_activity(payload, actor=current_user())
    return created(activity.to_dict(include_student=True), message="Activity recorded")


@activities_bp.post("/generate-routine")
@admin_required
def generate_routine():
    """Seed the default hostel routine so wardens only need to tick items off."""
    payload = load_payload(GenerateRoutineSchema, json_body(required=False))
    result = activity_service.generate_routine(payload, actor=current_user())
    return created(result, message=f"{result['created']} routine activities created")


@activities_bp.post("/bulk-complete")
@admin_required
def bulk_complete():
    body = json_body()
    student_ids = [int(value) for value in body.get("student_ids") or []]
    on_date = parse_date(body.get("date"), "date", default=date.today())
    updated = activity_service.bulk_complete(
        student_ids, body.get("activity_type"), on_date, actor=current_user()
    )
    return success({"updated": updated}, message=f"{updated} activity record(s) completed")


@activities_bp.patch("/<int:activity_id>")
@admin_required
def update_activity(activity_id):
    activity = activity_service.get_activity(activity_id)
    payload = load_payload(ActivityUpdateSchema, json_body(), partial=True)
    activity_service.update_activity(activity, payload, actor=current_user())
    return success(activity.to_dict(include_student=True), message="Activity updated")


@activities_bp.post("/<int:activity_id>/complete")
@admin_required
def complete_activity(activity_id):
    activity = activity_service.get_activity(activity_id)
    body = json_body(required=False)
    activity_time = parse_time(body.get("activity_time"), "activity_time", default=None)
    activity_service.complete_activity(activity, actor=current_user(), activity_time=activity_time)
    return success(activity.to_dict(include_student=True), message="Activity marked complete")


@activities_bp.post("/<int:activity_id>/confirm")
@student_required
def confirm_activity(activity_id):
    """Students may confirm their own activities but never edit official fields."""
    activity = activity_service.get_activity(activity_id)
    activity_service.confirm_by_student(activity, current_student())
    return success(activity.to_dict(), message="Activity confirmed")


@activities_bp.delete("/<int:activity_id>")
@admin_required
def delete_activity(activity_id):
    activity = activity_service.get_activity(activity_id)
    activity_service.delete_activity(activity, actor=current_user())
    return success(message="Activity deleted")


@activities_bp.get("/<int:student_id>")
@auth_required
def student_timeline(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    on_date = parse_date(request.args.get("date"), "date", default=date.today())
    return success(activity_service.timeline(student.id, on_date))


@activities_bp.get("/<int:student_id>/range")
@auth_required
def student_range(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    start, end = resolve_period(request.args, default_days=7)
    filters = {"student_id": student.id, "start_date": start, "end_date": end}
    items, page, per_page, total = activity_service.list_activities(
        filters, restrict_ids=[student.id]
    )
    return paginated(items, page, per_page, total)
