"""Parent management and the admin verification workflow."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from ..constants import (
    AccountStatus,
    AuditAction,
    NotificationPriority,
    NotificationType,
    VerificationStatus,
)
from ..extensions import db
from ..models import Parent, Student, StudentParent, User
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.errors import BusinessRuleViolation, NotFound
from ..utils.mailer import send_account_status_email
from ..utils.pagination import paginate_query
from ..utils.security import normalize_phone
from ..utils.storage import save_document
from . import notification_service


def get_parent(parent_id):
    parent = db.session.get(Parent, int(parent_id))
    if parent is None:
        raise NotFound("Parent not found")
    return parent


def list_parents(filters, page=None, per_page=None):
    query = Parent.query.options(
        joinedload(Parent.user),
        joinedload(Parent.student_links).joinedload(StudentParent.student),
    ).join(User, User.id == Parent.user_id)

    search = (filters.get("q") or "").strip()
    if search:
        pattern = f"%{search.lower()}%"
        child_subquery = (
            select(StudentParent.parent_id)
            .join(Student, Student.id == StudentParent.student_id)
            .where(
                or_(
                    func.lower(Student.full_name).like(pattern),
                    func.lower(Student.student_code).like(pattern),
                )
            )
        )
        query = query.filter(
            or_(
                func.lower(User.full_name).like(pattern),
                func.lower(User.email).like(pattern),
                User.phone.like(f"%{search}%"),
                func.lower(Parent.claimed_student_code).like(pattern),
                Parent.id.in_(child_subquery),
            )
        )

    verification = VerificationStatus.coerce(filters.get("verification_status"))
    if verification:
        query = query.filter(Parent.verification_status == verification)

    account_status = AccountStatus.coerce(filters.get("account_status"))
    if account_status:
        query = query.filter(User.account_status == account_status)

    if filters.get("student_id"):
        linked = select(StudentParent.parent_id).where(
            StudentParent.student_id == int(filters["student_id"])
        )
        query = query.filter(Parent.id.in_(linked))

    sort_by = filters.get("sort_by") or "created_at"
    column = {
        "created_at": Parent.created_at,
        "full_name": User.full_name,
        "verification_status": Parent.verification_status,
    }.get(sort_by, Parent.created_at)
    descending = (filters.get("sort_dir") or "desc").lower() == "desc"
    query = query.order_by(column.desc() if descending else column.asc())

    return paginate_query(
        query,
        page,
        per_page,
        serializer=lambda parent: parent.to_dict(include_children=True),
    )


def review_payload(parent):
    """Everything an admin needs on the verification review screen."""
    data = parent.to_dict(include_children=True, include_documents=True)
    claimed = None
    if parent.claimed_student_code:
        claimed_student = db.session.execute(
            select(Student).where(
                func.lower(Student.student_code) == parent.claimed_student_code.lower()
            )
        ).scalars().first()
        if claimed_student:
            claimed = claimed_student.to_dict(include_parents=True)
    data["claimed_student"] = claimed
    return data


def verify_parent(parent, actor=None):
    if parent.verification_status == VerificationStatus.VERIFIED:
        return parent
    parent.verification_status = VerificationStatus.VERIFIED
    parent.verified_at = utcnow()
    parent.verified_by_id = getattr(actor, "id", None)
    parent.rejection_reason = None
    if parent.user:
        parent.user.account_status = AccountStatus.ACTIVE
        parent.user.is_email_verified = True

    # Auto-link the claimed student if it was not matched at registration.
    if parent.claimed_student_code and not parent.student_links:
        student = db.session.execute(
            select(Student).where(
                func.lower(Student.student_code) == parent.claimed_student_code.lower()
            )
        ).scalars().first()
        if student is not None:
            db.session.add(
                StudentParent(
                    student_id=student.id,
                    parent_id=parent.id,
                    relationship_type=parent.relationship_to_student,
                    is_primary=not student.parent_links,
                )
            )

    notification_service.notify_user(
        parent.user,
        NotificationType.ACCOUNT_VERIFICATION,
        "Account verified",
        "Your account has been verified. You can now view your child's daily records, "
        "attendance, meals, health updates and progress.",
        priority=NotificationPriority.HIGH,
        link="/parent/dashboard",
        created_by=actor,
    )
    if parent.user and parent.notify_email:
        send_account_status_email(parent.user, "Verified")
    record_audit(
        AuditAction.PARENT_VERIFIED,
        actor=actor,
        entity_type="parent",
        entity_id=parent.id,
        affected_user=parent.user,
        description=f"Verified parent {parent.user.full_name if parent.user else parent.id}",
    )
    db.session.commit()
    return parent


def reject_parent(parent, reason=None, actor=None):
    parent.verification_status = VerificationStatus.REJECTED
    parent.rejection_reason = reason
    parent.verified_at = None
    parent.verified_by_id = getattr(actor, "id", None)
    if parent.user:
        parent.user.account_status = AccountStatus.REJECTED
    notification_service.notify_user(
        parent.user,
        NotificationType.ACCOUNT_VERIFICATION,
        "Registration not approved",
        "Your registration could not be approved."
        + (f" Reason: {reason}" if reason else " Please contact the hostel office."),
        priority=NotificationPriority.HIGH,
        created_by=actor,
    )
    if parent.user and parent.notify_email:
        send_account_status_email(parent.user, "Rejected", reason)
    record_audit(
        AuditAction.PARENT_REJECTED,
        actor=actor,
        entity_type="parent",
        entity_id=parent.id,
        affected_user=parent.user,
        description=f"Rejected parent registration"
        + (f": {reason}" if reason else ""),
    )
    db.session.commit()
    return parent


def block_parent(parent, reason=None, actor=None):
    if parent.user:
        parent.user.account_status = AccountStatus.BLOCKED
    record_audit(
        AuditAction.PARENT_BLOCKED,
        actor=actor,
        entity_type="parent",
        entity_id=parent.id,
        affected_user=parent.user,
        description="Blocked parent account" + (f": {reason}" if reason else ""),
    )
    db.session.commit()
    return parent


def unblock_parent(parent, actor=None):
    if parent.user:
        parent.user.account_status = (
            AccountStatus.ACTIVE
            if parent.verification_status == VerificationStatus.VERIFIED
            else AccountStatus.PENDING_VERIFICATION
        )
    record_audit(
        AuditAction.PARENT_UNBLOCKED,
        actor=actor,
        entity_type="parent",
        entity_id=parent.id,
        affected_user=parent.user,
        description="Unblocked parent account",
    )
    db.session.commit()
    return parent


def remove_parent(parent, actor=None):
    """Deactivate rather than hard-delete so suggestions/audit history survive."""
    if parent.user:
        parent.user.account_status = AccountStatus.INACTIVE
    parent.verification_status = VerificationStatus.REJECTED
    StudentParent.query.filter(StudentParent.parent_id == parent.id).delete(
        synchronize_session=False
    )
    record_audit(
        AuditAction.PARENT_REMOVED,
        actor=actor,
        entity_type="parent",
        entity_id=parent.id,
        affected_user=parent.user,
        description="Parent account deactivated and unlinked from all students",
    )
    db.session.commit()
    return parent


def update_parent(parent, data, actor=None):
    user = parent.user
    if user and "full_name" in data and data["full_name"]:
        user.full_name = data["full_name"]
    if user and "phone" in data:
        user.phone = normalize_phone(data["phone"])
    for field in ("address", "city", "relationship_to_student", "occupation"):
        if field in data:
            setattr(parent, field, data[field])
    if "alternate_phone" in data:
        parent.alternate_phone = normalize_phone(data["alternate_phone"])
    if "notify_email" in data:
        parent.notify_email = bool(data["notify_email"])
    record_audit(
        AuditAction.SETTINGS_UPDATED,
        actor=actor,
        entity_type="parent",
        entity_id=parent.id,
        affected_user=user,
        description="Updated parent profile",
    )
    db.session.commit()
    return parent


def upload_identity_document(parent, file_storage):
    parent.identity_document = save_document(file_storage, "documents", field="document")
    db.session.commit()
    return parent


def children_payload(parent):
    from . import student_service

    students = [link.student for link in parent.student_links if link.student is not None]
    active = [student for student in students if student.is_active]
    if not active:
        return []
    return student_service.decorate_students(active)


def ensure_child_access(parent, student_id):
    if parent.verification_status != VerificationStatus.VERIFIED:
        raise BusinessRuleViolation("Your account is awaiting administrator verification.")
    student = db.session.get(Student, int(student_id))
    if student is None:
        raise NotFound("Student not found")
    if student.id not in {link.student_id for link in parent.student_links}:
        raise NotFound("Student not found")
    return student


def pending_verification_count():
    return (
        db.session.execute(
            select(func.count(Parent.id)).where(
                Parent.verification_status == VerificationStatus.PENDING
            )
        ).scalar()
        or 0
    )
