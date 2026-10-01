"""Health record endpoints: /api/health/*

Medical data is sensitive. Every read is ownership-checked and every write is
ADMIN only.
"""

from flask import Blueprint, request

from ..decorators import (
    accessible_student_ids,
    admin_required,
    auth_required,
    authorize_student_access,
    current_user,
)
from ..schemas import HealthRecordSchema, HealthRecordUpdateSchema, load_payload
from ..services import health_service
from ..utils.dates import parse_date
from ..utils.request_helpers import bool_arg, json_body
from ..utils.responses import created, paginated, success

health_bp = Blueprint("health", __name__, url_prefix="/api/health")


@health_bp.get("")
@auth_required
def list_records():
    filters = {
        "student_id": request.args.get("student_id"),
        "status": request.args.get("status"),
        "severity": request.args.get("severity"),
        "recovery_status": request.args.get("recovery_status"),
        "start_date": parse_date(request.args.get("start_date"), "start_date", default=None),
        "end_date": parse_date(request.args.get("end_date"), "end_date", default=None),
        "urgent_only": bool_arg("urgent_only"),
    }
    restrict = accessible_student_ids()
    if filters["student_id"]:
        authorize_student_access(filters["student_id"], allow_inactive=True)
        restrict = None if current_user().is_admin else [int(filters["student_id"])]
    items, page, per_page, total = health_service.list_records(filters, restrict_ids=restrict)
    return paginated(items, page, per_page, total)


@health_bp.get("/overview")
@admin_required
def overview():
    return success(
        {
            "counts": health_service.hostel_overview(),
            "active_cases": health_service.active_cases(limit=25),
        }
    )


@health_bp.post("")
@admin_required
def create_record():
    payload = load_payload(HealthRecordSchema, json_body())
    record = health_service.create_record(payload, actor=current_user())
    return created(record.to_dict(include_student=True), message="Health record saved")


@health_bp.patch("/<int:record_id>")
@admin_required
def update_record(record_id):
    record = health_service.get_record(record_id)
    payload = load_payload(HealthRecordUpdateSchema, json_body(), partial=True)
    health_service.update_record(record, payload, actor=current_user())
    return success(record.to_dict(include_student=True), message="Health record updated")


@health_bp.post("/<int:record_id>/recovered")
@admin_required
def mark_recovered(record_id):
    record = health_service.get_record(record_id)
    body = json_body(required=False)
    health_service.mark_recovered(record, actor=current_user(), remarks=body.get("remarks"))
    return success(record.to_dict(include_student=True), message="Marked as recovered")


@health_bp.delete("/<int:record_id>")
@admin_required
def delete_record(record_id):
    record = health_service.get_record(record_id)
    health_service.delete_record(record, actor=current_user())
    return success(message="Health record deleted")


@health_bp.get("/<int:student_id>")
@auth_required
def student_health(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    return success(
        {
            "current": health_service.current_status(student.id),
            "timeline": health_service.timeline(student.id),
        }
    )


@health_bp.get("/<int:student_id>/current")
@auth_required
def student_current(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    return success(health_service.current_status(student.id))
