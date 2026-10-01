"""Progress and academic result endpoints: /api/progress/*"""

from flask import Blueprint, request

from ..decorators import (
    accessible_student_ids,
    admin_required,
    auth_required,
    authorize_student_access,
    current_user,
)
from ..schemas import (
    AcademicRecordSchema,
    AcademicRecordUpdateSchema,
    BulkProgressSchema,
    ProgressRecordSchema,
    load_payload,
)
from ..services import progress_service
from ..utils.dates import parse_date
from ..utils.request_helpers import int_arg, json_body
from ..utils.responses import created, paginated, success

progress_bp = Blueprint("progress", __name__, url_prefix="/api/progress")


@progress_bp.get("/categories")
@auth_required
def categories():
    return success(progress_service.list_categories())


@progress_bp.get("/academic")
@auth_required
def list_academic():
    filters = {
        "student_id": request.args.get("student_id"),
        "subject": request.args.get("subject"),
        "start_date": parse_date(request.args.get("start_date"), "start_date", default=None),
        "end_date": parse_date(request.args.get("end_date"), "end_date", default=None),
    }
    restrict = accessible_student_ids()
    if filters["student_id"]:
        authorize_student_access(filters["student_id"], allow_inactive=True)
        restrict = None if current_user().is_admin else [int(filters["student_id"])]
    items, page, per_page, total = progress_service.list_academic_records(
        filters, restrict_ids=restrict
    )
    return paginated(items, page, per_page, total)


@progress_bp.post("/academic")
@admin_required
def create_academic():
    payload = load_payload(AcademicRecordSchema, json_body())
    record = progress_service.create_academic_record(payload, actor=current_user())
    return created(record.to_dict(include_student=True), message="Academic result saved")


@progress_bp.patch("/academic/<int:record_id>")
@admin_required
def update_academic(record_id):
    record = progress_service.get_academic_record(record_id)
    payload = load_payload(AcademicRecordUpdateSchema, json_body(), partial=True)
    progress_service.update_academic_record(record, payload, actor=current_user())
    return success(record.to_dict(include_student=True), message="Academic result updated")


@progress_bp.delete("/academic/<int:record_id>")
@admin_required
def delete_academic(record_id):
    record = progress_service.get_academic_record(record_id)
    progress_service.delete_academic_record(record, actor=current_user())
    return success(message="Academic result deleted")


@progress_bp.post("")
@admin_required
def upsert_progress():
    payload = load_payload(ProgressRecordSchema, json_body())
    record = progress_service.upsert_progress(payload, actor=current_user())
    return created(record.to_dict(), message="Progress saved")


@progress_bp.post("/bulk")
@admin_required
def bulk_progress():
    payload = load_payload(BulkProgressSchema, json_body())
    records = progress_service.bulk_upsert_progress(payload, actor=current_user())
    return created(
        [record.to_dict() for record in records],
        message=f"{len(records)} progress score(s) saved",
    )


@progress_bp.delete("/<int:record_id>")
@admin_required
def delete_progress(record_id):
    progress_service.delete_progress_record(record_id, actor=current_user())
    return success(message="Progress record deleted")


@progress_bp.get("/student/<int:student_id>")
@auth_required
def student_progress(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    return success(progress_service.overview(student.id))


@progress_bp.get("/student/<int:student_id>/current")
@auth_required
def student_current(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    year = int_arg("year")
    month = int_arg("month")
    return success(progress_service.current_progress(student.id, year, month))


@progress_bp.get("/student/<int:student_id>/history")
@auth_required
def student_history(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    months = int_arg("months", 6)
    return success(progress_service.progress_history(student.id, months=max(1, min(months, 24))))
