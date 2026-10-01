"""Student management endpoints: /api/students/*

Writes are ADMIN only. Reads pass through ``authorize_student_access`` so a
parent can only ever load their own child and a student only themselves.
"""

from flask import Blueprint, request

from ..decorators import (
    accessible_student_ids,
    admin_required,
    auth_required,
    authorize_student_access,
    current_user,
)
from ..schemas import (
    AssignBedSchema,
    AssignParentSchema,
    BlockSchema,
    StatusUpdateSchema,
    StudentAccountSchema,
    StudentCreateSchema,
    StudentUpdateSchema,
    load_payload,
)
from ..services import (
    activity_service,
    attendance_service,
    health_service,
    progress_service,
    school_service,
    student_service,
)
from ..utils.dates import parse_date
from ..utils.request_helpers import bool_arg, json_body
from ..utils.responses import created, paginated, success

students_bp = Blueprint("students", __name__, url_prefix="/api/students")


def _filters():
    args = request.args
    has_login = args.get("has_login")
    is_active = args.get("is_active")
    return {
        "q": args.get("q"),
        "student_class": args.get("student_class"),
        "school": args.get("school"),
        "room_id": args.get("room_id"),
        "verification_status": args.get("verification_status"),
        "current_status": args.get("current_status") or args.get("status"),
        "attendance": args.get("attendance"),
        "health": args.get("health"),
        "has_login": None if has_login in (None, "") else bool_arg("has_login"),
        "is_active": None if is_active in (None, "") else bool_arg("is_active", True),
        "unassigned": bool_arg("unassigned"),
        "date": parse_date(args.get("date"), "date", default=None),
        "sort_by": args.get("sort_by"),
        "sort_dir": args.get("sort_dir"),
    }


@students_bp.get("")
@auth_required
def list_students():
    """Admins see everyone; parents/students are restricted to their own scope."""
    restrict = accessible_student_ids()
    items, page, per_page, total = student_service.list_students(
        _filters(), restrict_ids=restrict
    )
    return paginated(items, page, per_page, total)


@students_bp.get("/filter-options")
@admin_required
def filter_options():
    return success(student_service.filter_options())


@students_bp.post("")
@admin_required
def create_student():
    payload = load_payload(StudentCreateSchema, json_body())
    student = student_service.create_student(payload, actor=current_user())
    return created(student.to_dict(), message="Student added successfully")


@students_bp.get("/<int:student_id>")
@auth_required
def get_student(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    data = student.to_dict()
    data["today_attendance"] = student_service.today_attendance_map([student.id]).get(student.id)
    data["health"] = health_service.current_status(student.id)
    return success(data)


@students_bp.get("/<int:student_id>/overview")
@auth_required
def student_overview(student_id):
    """Everything the detailed profile page needs, in one request."""
    from datetime import date

    student = authorize_student_access(student_id, allow_inactive=True)
    today = parse_date(request.args.get("date"), "date", default=date.today())
    return success(
        {
            "student": student.to_dict(),
            "health": health_service.current_status(student.id),
            "attendance_month": attendance_service.monthly_summary(
                student.id, today.year, today.month
            ),
            "attendance_trend": attendance_service.monthly_trend(student.id, months=6),
            "school_today": school_service.status_for_date(student.id, today),
            "timeline": activity_service.timeline(student.id, today),
            "progress": progress_service.current_progress(student.id),
            "subjects": progress_service.subject_averages(student.id),
            "status_history": student_service.status_timeline(student, limit=20),
        }
    )


@students_bp.put("/<int:student_id>")
@students_bp.patch("/<int:student_id>")
@admin_required
def update_student(student_id):
    student = student_service.get_student(student_id)
    payload = load_payload(StudentUpdateSchema, json_body(), partial=True)
    student_service.update_student(student, payload, actor=current_user())
    return success(student.to_dict(), message="Student updated successfully")


@students_bp.post("/<int:student_id>/photo")
@admin_required
def upload_student_photo(student_id):
    student = student_service.get_student(student_id)
    student_service.upload_photo(student, request.files.get("photo"), actor=current_user())
    return success({"profile_photo": student.profile_photo}, message="Photo uploaded")


@students_bp.post("/<int:student_id>/verify")
@admin_required
def verify_student(student_id):
    student = student_service.get_student(student_id)
    student_service.verify_student(student, actor=current_user())
    return success(student.to_dict(), message="Student verified")


@students_bp.post("/<int:student_id>/block")
@admin_required
def block_student(student_id):
    student = student_service.get_student(student_id)
    payload = load_payload(BlockSchema, json_body(required=False), partial=True)
    student_service.block_student(student, payload.get("reason"), actor=current_user())
    return success(student.to_dict(), message="Student account blocked")


@students_bp.post("/<int:student_id>/unblock")
@admin_required
def unblock_student(student_id):
    student = student_service.get_student(student_id)
    student_service.unblock_student(student, actor=current_user())
    return success(student.to_dict(), message="Student account unblocked")


@students_bp.delete("/<int:student_id>")
@admin_required
def archive_student(student_id):
    """Soft delete - historical records are preserved for accountability."""
    student = student_service.get_student(student_id)
    payload = load_payload(BlockSchema, json_body(required=False), partial=True)
    student_service.archive_student(student, actor=current_user(), reason=payload.get("reason"))
    return success(message="Student archived. Their records have been preserved.")


@students_bp.post("/<int:student_id>/restore")
@admin_required
def restore_student(student_id):
    student = student_service.get_student(student_id)
    student_service.restore_student(student, actor=current_user())
    return success(student.to_dict(), message="Student restored")


# --- relationships --------------------------------------------------------
@students_bp.post("/<int:student_id>/parents")
@admin_required
def assign_parent(student_id):
    student = student_service.get_student(student_id)
    payload = load_payload(AssignParentSchema, json_body())
    student_service.link_parent(
        student,
        payload["parent_id"],
        relationship_type=payload.get("relationship_type"),
        is_primary=payload.get("is_primary", False),
        actor=current_user(),
    )
    return success(student.to_dict(), message="Parent linked to student")


@students_bp.delete("/<int:student_id>/parents/<int:parent_id>")
@admin_required
def unlink_parent(student_id, parent_id):
    student = student_service.get_student(student_id)
    student_service.unlink_parent(student, parent_id, actor=current_user())
    return success(message="Parent unlinked from student")


@students_bp.put("/<int:student_id>/bed")
@admin_required
def assign_bed(student_id):
    student = student_service.get_student(student_id)
    payload = load_payload(AssignBedSchema, json_body(required=False), partial=True)
    student_service.assign_bed(student, payload.get("bed_id"), actor=current_user())
    return success(student.to_dict(), message="Room/bed assignment updated")


# --- optional login account ----------------------------------------------
@students_bp.post("/<int:student_id>/account")
@admin_required
def create_account(student_id):
    student = student_service.get_student(student_id)
    payload = load_payload(StudentAccountSchema, json_body())
    user = student_service.create_student_account(student, payload, actor=current_user())
    return created(
        {"student": student.to_dict(), "account": user.to_dict()},
        message="Student login account created",
    )


@students_bp.delete("/<int:student_id>/account")
@admin_required
def revoke_account(student_id):
    student = student_service.get_student(student_id)
    student_service.revoke_student_account(student, actor=current_user())
    return success(message="Student login account removed")


# --- activity status -----------------------------------------------------
@students_bp.post("/<int:student_id>/status")
@admin_required
def change_status(student_id):
    student = student_service.get_student(student_id)
    payload = load_payload(StatusUpdateSchema, json_body())
    history = student_service.change_status(
        student, payload["status"], payload.get("remarks"), actor=current_user()
    )
    return success(
        {"student": student.to_summary(), "history": history.to_dict()},
        message="Student status updated",
    )


@students_bp.get("/<int:student_id>/status-history")
@auth_required
def status_history(student_id):
    student = authorize_student_access(student_id, allow_inactive=True)
    return success(student_service.status_timeline(student))
