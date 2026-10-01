"""Authentication & authorization decorators.

Backend authorization is the single source of truth. Frontend route guards are
only a UX convenience - every protected endpoint independently verifies:

1. a valid, non-revoked JWT
2. the user identity still exists
3. the account is in a state that may act
4. the role is allowed for this endpoint
5. ownership of the requested resource (see :func:`authorize_student_access`)
"""

from functools import wraps

from flask import g
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from ..constants import AccountStatus, UserRole, VerificationStatus
from ..extensions import db
from ..models import Parent, Student, User
from ..utils.errors import AuthenticationFailed, NotFound, PermissionDenied


def _load_user_from_jwt():
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        raise AuthenticationFailed("Invalid authentication token")
    user = db.session.get(User, user_id)
    if user is None:
        raise AuthenticationFailed("Account no longer exists")
    if user.account_status in (
        AccountStatus.BLOCKED,
        AccountStatus.REJECTED,
        AccountStatus.INACTIVE,
    ):
        raise PermissionDenied(
            "This account has been blocked or deactivated. Please contact the administrator."
        )
    claims = get_jwt()
    g.current_user = user
    g.jwt_claims = claims
    return user


def current_user():
    """The authenticated ``User`` for this request (``None`` when anonymous)."""
    return getattr(g, "current_user", None)


def current_parent():
    user = current_user()
    if user is None or not user.is_parent:
        return None
    return user.parent_profile


def current_student():
    user = current_user()
    if user is None or not user.is_student:
        return None
    return user.student_profile


def auth_required(fn):
    """Any authenticated, non-blocked user."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        _load_user_from_jwt()
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles):
    allowed = {UserRole.coerce(role) for role in roles}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = _load_user_from_jwt()
            if user.role not in allowed:
                raise PermissionDenied(
                    "Your role is not permitted to perform this action."
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def admin_required(fn):
    """ADMIN only. Guards every official-record mutation."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = _load_user_from_jwt()
        if not user.is_admin:
            raise PermissionDenied("Administrator access is required.")
        if user.account_status != AccountStatus.ACTIVE:
            raise PermissionDenied("Your administrator account is not active.")
        return fn(*args, **kwargs)

    return wrapper


def super_admin_required(fn):
    """Only a super administrator may create or demote other administrators."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = _load_user_from_jwt()
        if not user.is_admin or not user.is_super_admin:
            raise PermissionDenied("Only a super administrator may perform this action.")
        return fn(*args, **kwargs)

    return wrapper


def parent_required(verified=True):
    """PARENT only. ``verified=True`` also demands an admin-verified profile."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = _load_user_from_jwt()
            if not user.is_parent:
                raise PermissionDenied("Parent access is required.")
            profile = user.parent_profile
            if profile is None:
                raise NotFound("Parent profile not found.")
            if verified and profile.verification_status != VerificationStatus.VERIFIED:
                raise PermissionDenied(
                    "Your account is awaiting administrator verification. "
                    "You will be able to view your child's information once verified."
                )
            g.current_parent = profile
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def student_required(fn):
    """STUDENT only, with an attached student profile."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = _load_user_from_jwt()
        if not user.is_student:
            raise PermissionDenied("Student access is required.")
        profile = user.student_profile
        if profile is None:
            raise NotFound("Student profile not found.")
        if not profile.is_active:
            raise PermissionDenied("This student record has been deactivated.")
        g.current_student = profile
        return fn(*args, **kwargs)

    return wrapper


def authorize_student_access(student_id, allow_inactive=False):
    """Resolve a student *and* prove the caller may read it.

    This is the single guard that stops a parent from reading another family's
    child simply by editing the URL, and a student from reading a classmate's
    records.
    """
    user = current_user()
    if user is None:
        raise AuthenticationFailed("Authentication required")

    try:
        student_id = int(student_id)
    except (TypeError, ValueError):
        raise NotFound("Student not found")

    student = db.session.get(Student, student_id)
    if student is None:
        raise NotFound("Student not found")
    if not student.is_active and not allow_inactive and not user.is_admin:
        raise NotFound("Student not found")

    if user.is_admin:
        return student

    if user.is_parent:
        profile = user.parent_profile
        if profile is None:
            raise PermissionDenied("Parent profile not found.")
        if profile.verification_status != VerificationStatus.VERIFIED:
            raise PermissionDenied(
                "Your account is awaiting administrator verification."
            )
        link_exists = any(link.student_id == student.id for link in profile.student_links)
        if not link_exists:
            # Deliberately a 403 with a generic message: do not confirm or deny
            # the existence of another family's child.
            raise PermissionDenied("You are not authorised to view this student's information.")
        return student

    if user.is_student:
        if user.student_profile is None or user.student_profile.id != student.id:
            raise PermissionDenied("You may only access your own information.")
        return student

    raise PermissionDenied("You are not authorised to view this student's information.")


def accessible_student_ids():
    """Every student id the caller may read - used to scope list queries."""
    user = current_user()
    if user is None:
        return []
    if user.is_admin:
        return None  # None == unrestricted
    if user.is_parent:
        profile = user.parent_profile
        if profile is None or profile.verification_status != VerificationStatus.VERIFIED:
            return []
        return [link.student_id for link in profile.student_links]
    if user.is_student and user.student_profile:
        return [user.student_profile.id]
    return []


def authorize_parent_access(parent_id):
    """Admins may read any parent; a parent may only read themselves."""
    user = current_user()
    if user is None:
        raise AuthenticationFailed("Authentication required")
    try:
        parent_id = int(parent_id)
    except (TypeError, ValueError):
        raise NotFound("Parent not found")

    parent = db.session.get(Parent, parent_id)
    if parent is None:
        raise NotFound("Parent not found")
    if user.is_admin:
        return parent
    if user.is_parent and user.parent_profile and user.parent_profile.id == parent.id:
        return parent
    raise PermissionDenied("You are not authorised to view this parent profile.")
