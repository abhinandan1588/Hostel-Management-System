"""Authentication endpoints: /api/auth/*"""

from flask import Blueprint, current_app
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..constants import AuditAction
from ..decorators import auth_required, current_user
from ..extensions import db, limiter
from ..models import User
from ..schemas import (
    ChangePasswordSchema,
    ForgotPasswordSchema,
    LoginSchema,
    ParentRegistrationSchema,
    ResetPasswordSchema,
    UpdateOwnProfileSchema,
    load_payload,
)
from ..services import auth_service, parent_service
from ..utils.audit import record_audit
from ..utils.errors import AuthenticationFailed, PermissionDenied
from ..utils.request_helpers import json_body
from ..utils.responses import created, success
from ..utils.storage import save_image

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _auth_limit():
    return current_app.config.get("AUTH_RATELIMIT", "10 per minute")


@auth_bp.post("/register")
@limiter.limit(_auth_limit)
def register():
    """Parent self-registration. Creates a PENDING_VERIFICATION account."""
    payload = load_payload(ParentRegistrationSchema, json_body())
    user, parent, matched_student = auth_service.register_parent(payload)
    return created(
        {
            "user": user.to_dict(),
            "parent": parent.to_dict(),
            "matched_student": matched_student.to_summary() if matched_student else None,
            "requires_verification": True,
        },
        message="Registration received. An administrator will verify your account shortly.",
    )


@auth_bp.post("/login")
@limiter.limit(_auth_limit)
def login():
    payload = load_payload(LoginSchema, json_body())
    user = auth_service.authenticate(payload["identifier"], payload["password"])
    tokens = auth_service.build_tokens(user)
    return success(
        {**tokens, **auth_service.build_session_payload(user)},
        message=f"Welcome back, {user.full_name}.",
    )


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity)) if identity else None
    if user is None:
        raise AuthenticationFailed("Account no longer exists")
    if not user.can_login():
        raise PermissionDenied("This account is no longer active.")
    tokens = auth_service.build_tokens(user)
    return success({**tokens, "user": user.to_dict()}, message="Token refreshed")


@auth_bp.post("/logout")
@auth_required
def logout():
    user = current_user()
    auth_service.revoke_current_token(user)
    record_audit(
        AuditAction.LOGOUT,
        actor=user,
        entity_type="user",
        entity_id=user.id,
        affected_user=user,
        description="Signed out",
        commit=True,
    )
    return success(message="Signed out successfully")


@auth_bp.get("/me")
@auth_required
def me():
    user = current_user()
    return success(auth_service.build_session_payload(user))


@auth_bp.get("/validate")
@auth_required
def validate():
    user = current_user()
    return success(
        {"valid": True, "user_id": user.id, "role": user.role.value},
        message="Token is valid",
    )


@auth_bp.post("/forgot-password")
@limiter.limit(_auth_limit)
def forgot_password():
    payload = load_payload(ForgotPasswordSchema, json_body())
    token = auth_service.request_password_reset(payload["email"])
    data = {}
    # Only surfaced when SMTP is intentionally disabled (local development).
    if token and not current_app.config.get("MAIL_ENABLED"):
        data["reset_token"] = token
        data["delivery"] = "mail_disabled"
    return success(
        data,
        message="If an account exists for that email address, a reset link has been sent.",
    )


@auth_bp.post("/reset-password")
@limiter.limit(_auth_limit)
def reset_password():
    payload = load_payload(ResetPasswordSchema, json_body())
    auth_service.reset_password(payload["token"], payload["password"])
    return success(message="Password updated. You can now sign in with your new password.")


@auth_bp.post("/change-password")
@auth_required
def change_password():
    payload = load_payload(ChangePasswordSchema, json_body())
    auth_service.change_password(
        current_user(), payload["current_password"], payload["new_password"]
    )
    return success(message="Password changed successfully")


@auth_bp.patch("/profile")
@auth_required
def update_profile():
    """Update the caller's own account details."""
    user = current_user()
    payload = load_payload(UpdateOwnProfileSchema, json_body(), partial=True)
    if "full_name" in payload and payload["full_name"]:
        user.full_name = payload["full_name"]
    if "phone" in payload:
        from ..utils.security import normalize_phone

        user.phone = normalize_phone(payload["phone"])
    if user.is_parent and user.parent_profile:
        parent_service.update_parent(user.parent_profile, payload, actor=user)
    else:
        db.session.commit()
    return success(auth_service.build_session_payload(user), message="Profile updated")


@auth_bp.post("/profile/photo")
@auth_required
def upload_profile_photo():
    from flask import request

    user = current_user()
    previous = user.profile_photo
    user.profile_photo = save_image(request.files.get("photo"), "avatars", field="photo")
    db.session.commit()
    if previous:
        from ..utils.storage import delete_file

        delete_file(previous)
    return success({"profile_photo": user.profile_photo}, message="Photo updated")
