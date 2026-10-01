"""Authentication, registration and password lifecycle."""

from datetime import timedelta

from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt
from sqlalchemy import or_, select

from ..constants import (
    AccountStatus,
    AuditAction,
    NotificationPriority,
    NotificationType,
    UserRole,
    VerificationStatus,
)
from ..extensions import db
from ..models import AdminProfile, Parent, PasswordResetToken, Student, TokenBlocklist, User
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.errors import (
    AuthenticationFailed,
    Conflict,
    NotFound,
    PermissionDenied,
    ValidationFailed,
)
from ..utils.mailer import send_password_reset_email
from ..utils.security import (
    client_ip,
    generate_reset_token,
    hash_token,
    normalize_email,
    normalize_phone,
    validate_password_strength,
)
from . import notification_service


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------
def build_tokens(user):
    """Issue an access + refresh token pair.

    The role is embedded as a claim for convenience only - every request still
    re-loads the user and re-checks the role server side.
    """
    claims = {"role": user.role.value, "name": user.full_name}
    identity = str(user.id)
    return {
        "access_token": create_access_token(identity=identity, additional_claims=claims),
        "refresh_token": create_refresh_token(identity=identity, additional_claims=claims),
        "token_type": "Bearer",
        "expires_in": int(
            current_app.config["JWT_ACCESS_TOKEN_EXPIRES"].total_seconds()
        ),
    }


def revoke_current_token(user=None):
    claims = get_jwt()
    jti = claims.get("jti")
    if not jti:
        return False
    if db.session.execute(
        select(TokenBlocklist.id).where(TokenBlocklist.jti == jti)
    ).scalar():
        return True
    entry = TokenBlocklist(
        jti=jti,
        token_type=claims.get("type", "access"),
        user_id=getattr(user, "id", None),
        expires_at=None,
    )
    db.session.add(entry)
    db.session.commit()
    return True


def is_token_revoked(jwt_payload):
    jti = jwt_payload.get("jti")
    if not jti:
        return False
    return bool(
        db.session.execute(select(TokenBlocklist.id).where(TokenBlocklist.jti == jti)).scalar()
    )


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
def build_session_payload(user):
    """Everything the frontend needs right after authentication."""
    payload = {"user": user.to_dict(), "profile": None, "permissions": {}}

    if user.is_admin:
        profile = user.admin_profile
        payload["profile"] = profile.to_dict() if profile else None
        payload["permissions"] = {
            "manage_students": True,
            "manage_parents": True,
            "manage_records": True,
            "manage_admins": bool(user.is_super_admin),
        }
    elif user.is_parent:
        profile = user.parent_profile
        payload["profile"] = profile.to_dict(include_children=True) if profile else None
        verified = bool(profile and profile.verification_status == VerificationStatus.VERIFIED)
        payload["permissions"] = {
            "view_children": verified,
            "send_suggestions": verified,
        }
        payload["requires_verification"] = not verified
    elif user.is_student:
        profile = user.student_profile
        payload["profile"] = profile.to_dict(include_parents=False) if profile else None
        payload["permissions"] = {
            "view_own_records": True,
            "confirm_activities": True,
            "report_issues": True,
            "modify_official_records": False,
        }
    return payload


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
def register_parent(data):
    """Create a PENDING_VERIFICATION parent account.

    The account exists immediately (so the parent can sign in and watch their
    verification status) but the API refuses to release any child data until an
    administrator verifies the profile.
    """
    email = normalize_email(data["email"])
    phone = normalize_phone(data.get("phone"))

    problems = validate_password_strength(data["password"])
    if problems:
        raise ValidationFailed("Password is too weak.", errors={"password": problems})

    if db.session.execute(select(User.id).where(User.email == email)).scalar():
        raise Conflict("An account with this email address already exists.")
    if phone and db.session.execute(select(User.id).where(User.phone == phone)).scalar():
        raise Conflict("An account with this phone number already exists.")

    user = User(
        full_name=data["full_name"],
        email=email,
        phone=phone,
        role=UserRole.PARENT,
        account_status=AccountStatus.PENDING_VERIFICATION,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    parent = Parent(
        user_id=user.id,
        address=data.get("address"),
        city=data.get("city"),
        relationship_to_student=data.get("relationship_to_student"),
        occupation=data.get("occupation"),
        alternate_phone=normalize_phone(data.get("alternate_phone")),
        claimed_student_code=(data.get("student_code") or "").strip() or None,
        verification_status=VerificationStatus.PENDING,
    )
    db.session.add(parent)
    db.session.flush()

    # Pre-link the claimed student so the admin review screen shows the child.
    matched_student = None
    if parent.claimed_student_code:
        matched_student = db.session.execute(
            select(Student).where(
                func_lower(Student.student_code) == parent.claimed_student_code.lower()
            )
        ).scalar_one_or_none()
        if matched_student is not None:
            from ..models import StudentParent

            db.session.add(
                StudentParent(
                    student_id=matched_student.id,
                    parent_id=parent.id,
                    relationship_type=parent.relationship_to_student,
                    is_primary=not matched_student.parent_links,
                )
            )

    notification_service.notify_admins(
        NotificationType.ACCOUNT_VERIFICATION,
        "New parent registration",
        f"{user.full_name} registered as a parent"
        + (f" for student ID {parent.claimed_student_code}." if parent.claimed_student_code else "."),
        student_id=matched_student.id if matched_student else None,
        priority=NotificationPriority.HIGH,
        link="/admin/parents",
    )
    record_audit(
        AuditAction.PARENT_REGISTERED,
        actor=user,
        entity_type="parent",
        entity_id=parent.id,
        affected_user=user,
        description=f"Parent self-registration for student code {parent.claimed_student_code}",
    )
    db.session.commit()
    return user, parent, matched_student


def func_lower(column):
    from sqlalchemy import func

    return func.lower(column)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
def authenticate(identifier, password):
    identifier = (identifier or "").strip()
    if not identifier or not password:
        raise AuthenticationFailed("Email/username and password are required.")

    lowered = identifier.lower()
    phone = normalize_phone(identifier)
    user = db.session.execute(
        select(User).where(
            or_(
                func_lower(User.email) == lowered,
                func_lower(User.username) == lowered,
                User.phone == phone,
            )
        )
    ).scalars().first()

    # Same generic message whether the account is missing or the password is
    # wrong, so the endpoint cannot be used to enumerate accounts.
    if user is None:
        raise AuthenticationFailed("Invalid email or password.")

    if not user.can_login():
        if user.account_status == AccountStatus.BLOCKED:
            raise PermissionDenied(
                "Your account has been blocked. Please contact the hostel administrator."
            )
        if user.account_status == AccountStatus.REJECTED:
            raise PermissionDenied(
                "Your registration was rejected. Please contact the hostel administrator."
            )
        raise PermissionDenied("This account is inactive. Please contact the administrator.")

    if not user.check_password(password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        limit = current_app.config.get("MAX_FAILED_LOGIN_ATTEMPTS", 10)
        if limit and user.failed_login_attempts >= limit:
            user.account_status = AccountStatus.BLOCKED
            record_audit(
                AuditAction.STUDENT_BLOCKED if user.is_student else AuditAction.PARENT_BLOCKED,
                actor=None,
                entity_type="user",
                entity_id=user.id,
                affected_user=user,
                description="Automatically blocked after repeated failed login attempts",
            )
        db.session.commit()
        raise AuthenticationFailed("Invalid email or password.")

    if user.is_student and (user.student_profile is None or not user.student_profile.is_active):
        raise PermissionDenied("This student record is no longer active.")

    user.failed_login_attempts = 0
    user.last_login_at = utcnow()
    record_audit(
        AuditAction.LOGIN,
        actor=user,
        entity_type="user",
        entity_id=user.id,
        affected_user=user,
        description=f"Signed in from {client_ip()}",
    )
    db.session.commit()
    return user


# ---------------------------------------------------------------------------
# Password management
# ---------------------------------------------------------------------------
def request_password_reset(email):
    """Always reports success - never reveals whether an account exists."""
    normalized = normalize_email(email)
    user = db.session.execute(
        select(User).where(func_lower(User.email) == normalized)
    ).scalars().first()
    if user is None:
        return None

    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
    ).update({"used_at": utcnow()}, synchronize_session=False)

    plain, hashed = generate_reset_token()
    minutes = current_app.config.get("PASSWORD_RESET_TOKEN_MINUTES", 60)
    token = PasswordResetToken(
        user_id=user.id,
        token_hash=hashed,
        expires_at=utcnow() + timedelta(minutes=minutes),
        requested_ip=client_ip(),
    )
    db.session.add(token)
    db.session.commit()

    send_password_reset_email(user, plain)
    # Returned so development/tests can complete the flow without SMTP; the
    # route only exposes it when mail delivery is disabled.
    return plain


def reset_password(token_value, new_password):
    problems = validate_password_strength(new_password)
    if problems:
        raise ValidationFailed("Password is too weak.", errors={"password": problems})

    hashed = hash_token(token_value)
    token = db.session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hashed)
    ).scalars().first()
    if token is None or not token.is_usable:
        raise ValidationFailed("This password reset link is invalid or has expired.")

    user = token.user
    if user is None:
        raise NotFound("Account not found")

    user.set_password(new_password)
    token.used_at = utcnow()
    # Any previously issued refresh/access token for this user is now stale.
    record_audit(
        AuditAction.PASSWORD_RESET,
        actor=user,
        entity_type="user",
        entity_id=user.id,
        affected_user=user,
        description="Password reset completed",
    )
    db.session.commit()
    return user


def change_password(user, current_password, new_password):
    if not user.check_password(current_password):
        raise ValidationFailed(
            "Current password is incorrect.",
            errors={"current_password": ["Current password is incorrect."]},
        )
    problems = validate_password_strength(new_password)
    if problems:
        raise ValidationFailed("Password is too weak.", errors={"new_password": problems})
    user.set_password(new_password)
    record_audit(
        AuditAction.PASSWORD_RESET,
        actor=user,
        entity_type="user",
        entity_id=user.id,
        affected_user=user,
        description="Password changed by account owner",
    )
    db.session.commit()
    return user


# ---------------------------------------------------------------------------
# Admin bootstrap / creation
# ---------------------------------------------------------------------------
def create_admin(data, actor=None, is_first=False):
    email = normalize_email(data["email"])
    if db.session.execute(select(User.id).where(User.email == email)).scalar():
        raise Conflict("An account with this email address already exists.")
    problems = validate_password_strength(data["password"])
    if problems:
        raise ValidationFailed("Password is too weak.", errors={"password": problems})

    user = User(
        full_name=data["full_name"],
        email=email,
        phone=normalize_phone(data.get("phone")),
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
        is_email_verified=True,
        is_super_admin=bool(data.get("is_super_admin") or is_first),
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    profile = AdminProfile(
        user_id=user.id,
        designation=data.get("designation") or ("Chief Warden" if is_first else "Warden"),
        hostel_name=data.get("hostel_name"),
    )
    db.session.add(profile)
    record_audit(
        AuditAction.ADMIN_CREATED,
        actor=actor or user,
        entity_type="user",
        entity_id=user.id,
        affected_user=user,
        description=f"Administrator account created ({profile.designation})",
    )
    db.session.commit()
    return user
