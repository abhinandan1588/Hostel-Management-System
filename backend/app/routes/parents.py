"""Admin-facing parent management: /api/parents/*"""

from flask import Blueprint, request

from ..decorators import admin_required, auth_required, authorize_parent_access, current_user
from ..schemas import (
    BlockSchema,
    ParentAdminUpdateSchema,
    ParentVerificationSchema,
    load_payload,
)
from ..services import communication_service, parent_service
from ..utils.request_helpers import bool_arg, json_body
from ..utils.responses import paginated, success

parents_bp = Blueprint("parents", __name__, url_prefix="/api/parents")


@parents_bp.get("")
@admin_required
def list_parents():
    filters = {
        "q": request.args.get("q"),
        "verification_status": request.args.get("verification_status"),
        "account_status": request.args.get("account_status"),
        "student_id": request.args.get("student_id"),
        "sort_by": request.args.get("sort_by"),
        "sort_dir": request.args.get("sort_dir"),
    }
    items, page, per_page, total = parent_service.list_parents(filters)
    return paginated(
        items,
        page,
        per_page,
        total,
        extra={"pending_verification": parent_service.pending_verification_count()},
    )


@parents_bp.get("/<int:parent_id>")
@auth_required
def get_parent(parent_id):
    parent = authorize_parent_access(parent_id)
    include_documents = current_user().is_admin
    return success(
        parent.to_dict(include_children=True, include_documents=include_documents)
    )


@parents_bp.get("/<int:parent_id>/review")
@admin_required
def review_parent(parent_id):
    """Full verification review payload: profile, child, documents, contact."""
    parent = parent_service.get_parent(parent_id)
    return success(parent_service.review_payload(parent))


@parents_bp.get("/<int:parent_id>/children")
@auth_required
def parent_children(parent_id):
    parent = authorize_parent_access(parent_id)
    return success(parent_service.children_payload(parent))


@parents_bp.get("/<int:parent_id>/suggestions")
@admin_required
def parent_suggestions(parent_id):
    parent = parent_service.get_parent(parent_id)
    items, page, per_page, total = communication_service.list_suggestions(
        {}, parent_id=parent.id
    )
    return paginated(items, page, per_page, total)


@parents_bp.post("/<int:parent_id>/verify")
@admin_required
def verify_parent(parent_id):
    parent = parent_service.get_parent(parent_id)
    parent_service.verify_parent(parent, actor=current_user())
    return success(
        parent.to_dict(include_children=True), message="Parent verified successfully"
    )


@parents_bp.post("/<int:parent_id>/reject")
@admin_required
def reject_parent(parent_id):
    parent = parent_service.get_parent(parent_id)
    payload = load_payload(ParentVerificationSchema, json_body(required=False), partial=True)
    parent_service.reject_parent(parent, payload.get("reason"), actor=current_user())
    return success(parent.to_dict(), message="Parent registration rejected")


@parents_bp.post("/<int:parent_id>/block")
@admin_required
def block_parent(parent_id):
    parent = parent_service.get_parent(parent_id)
    payload = load_payload(BlockSchema, json_body(required=False), partial=True)
    parent_service.block_parent(parent, payload.get("reason"), actor=current_user())
    return success(parent.to_dict(), message="Parent account blocked")


@parents_bp.post("/<int:parent_id>/unblock")
@admin_required
def unblock_parent(parent_id):
    parent = parent_service.get_parent(parent_id)
    parent_service.unblock_parent(parent, actor=current_user())
    return success(parent.to_dict(), message="Parent account unblocked")


@parents_bp.patch("/<int:parent_id>")
@admin_required
def update_parent(parent_id):
    parent = parent_service.get_parent(parent_id)
    payload = load_payload(ParentAdminUpdateSchema, json_body(), partial=True)
    parent_service.update_parent(parent, payload, actor=current_user())
    return success(parent.to_dict(include_children=True), message="Parent profile updated")


@parents_bp.delete("/<int:parent_id>")
@admin_required
def remove_parent(parent_id):
    """Deactivates the account and unlinks children (records are preserved)."""
    parent = parent_service.get_parent(parent_id)
    parent_service.remove_parent(parent, actor=current_user())
    return success(message="Parent account removed")


@parents_bp.post("/<int:parent_id>/document")
@auth_required
def upload_document(parent_id):
    parent = authorize_parent_access(parent_id)
    parent_service.upload_identity_document(parent, request.files.get("document"))
    return success(
        {"identity_document": parent.identity_document}, message="Document uploaded"
    )


@parents_bp.get("/lookup")
@admin_required
def lookup_parents():
    """Lightweight list used by pickers (assign parent, emergency alerts)."""
    filters = {"q": request.args.get("q"), "verification_status": request.args.get("verification_status")}
    items, page, per_page, total = parent_service.list_parents(filters, page=1, per_page=100)
    verified_only = bool_arg("verified_only")
    options = [
        {
            "id": item["id"],
            "full_name": item["full_name"],
            "phone": item["phone"],
            "email": item["email"],
            "verification_status": item["verification_status"],
            "children": [child["full_name"] for child in item.get("children", [])],
        }
        for item in items
        if not verified_only or item["verification_status"] == "VERIFIED"
    ]
    return success(options, meta={"total": total, "page": page, "per_page": per_page})
