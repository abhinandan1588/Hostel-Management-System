"""Notification fan-out and inbox queries."""

from sqlalchemy import func, select

from ..constants import (
    NotificationPriority,
    NotificationType,
    UserRole,
    VerificationStatus,
)
from ..extensions import db
from ..models import Notification, Parent, Student, StudentParent, User
from ..models.base import utcnow
from ..utils.errors import NotFound
from ..utils.mailer import send_notification_email
from ..utils.pagination import paginate_query


def _recipient_ids_for_student(student, include_student_account=True):
    """Verified, active guardians of a student (+ the student's own account)."""
    rows = db.session.execute(
        select(User.id, User.email, User.full_name, Parent.notify_email)
        .join(Parent, Parent.user_id == User.id)
        .join(StudentParent, StudentParent.parent_id == Parent.id)
        .where(
            StudentParent.student_id == student.id,
            Parent.verification_status == VerificationStatus.VERIFIED,
        )
    ).all()
    recipients = [
        {"user_id": row[0], "email": row[1], "full_name": row[2], "notify_email": bool(row[3])}
        for row in rows
    ]
    if include_student_account and student.user_id:
        recipients.append(
            {
                "user_id": student.user_id,
                "email": student.user.email if student.user else None,
                "full_name": student.user.full_name if student.user else student.full_name,
                "notify_email": False,
            }
        )
    return recipients


def create_notification(
    user_id,
    notification_type,
    title,
    message,
    student_id=None,
    priority=NotificationPriority.NORMAL,
    link=None,
    created_by=None,
    commit=False,
):
    notification = Notification(
        user_id=user_id,
        student_id=student_id,
        type=notification_type,
        priority=priority,
        title=title,
        message=message,
        link=link,
        created_by_id=getattr(created_by, "id", None),
    )
    db.session.add(notification)
    if commit:
        db.session.commit()
    return notification


def notify_student_guardians(
    student,
    notification_type,
    title,
    message,
    priority=NotificationPriority.NORMAL,
    link=None,
    created_by=None,
    include_student_account=True,
    send_email=False,
):
    """Send one notification to every verified guardian of ``student``."""
    created = []
    for recipient in _recipient_ids_for_student(student, include_student_account):
        created.append(
            create_notification(
                user_id=recipient["user_id"],
                notification_type=notification_type,
                title=title,
                message=message,
                student_id=student.id,
                priority=priority,
                link=link,
                created_by=created_by,
            )
        )
        if send_email and recipient.get("notify_email") and recipient.get("email"):
            user = db.session.get(User, recipient["user_id"])
            if user:
                send_notification_email(user, title, message)
    return created


def notify_admins(
    notification_type,
    title,
    message,
    student_id=None,
    priority=NotificationPriority.NORMAL,
    link=None,
    created_by=None,
):
    admin_ids = db.session.execute(
        select(User.id).where(User.role == UserRole.ADMIN)
    ).scalars().all()
    return [
        create_notification(
            user_id=admin_id,
            notification_type=notification_type,
            title=title,
            message=message,
            student_id=student_id,
            priority=priority,
            link=link,
            created_by=created_by,
        )
        for admin_id in admin_ids
    ]


def notify_user(
    user,
    notification_type,
    title,
    message,
    student_id=None,
    priority=NotificationPriority.NORMAL,
    link=None,
    created_by=None,
    send_email=False,
):
    if user is None:
        return None
    notification = create_notification(
        user_id=user.id,
        notification_type=notification_type,
        title=title,
        message=message,
        student_id=student_id,
        priority=priority,
        link=link,
        created_by=created_by,
    )
    if send_email:
        send_notification_email(user, title, message)
    return notification


def list_notifications(user, unread_only=False, notification_type=None, page=None, per_page=None):
    query = Notification.query.filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    coerced = NotificationType.coerce(notification_type)
    if coerced:
        query = query.filter(Notification.type == coerced)
    query = query.order_by(Notification.created_at.desc(), Notification.id.desc())
    return paginate_query(query, page, per_page, serializer=lambda n: n.to_dict())


def unread_count(user):
    return (
        db.session.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user.id, Notification.is_read.is_(False)
            )
        ).scalar()
        or 0
    )


def mark_read(user, notification_id):
    notification = db.session.get(Notification, int(notification_id))
    if notification is None or notification.user_id != user.id:
        raise NotFound("Notification not found")
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = utcnow()
        db.session.commit()
    return notification


def mark_all_read(user):
    updated = (
        Notification.query.filter(
            Notification.user_id == user.id, Notification.is_read.is_(False)
        ).update({"is_read": True, "read_at": utcnow()}, synchronize_session=False)
    )
    db.session.commit()
    return updated


def delete_notification(user, notification_id):
    notification = db.session.get(Notification, int(notification_id))
    if notification is None or notification.user_id != user.id:
        raise NotFound("Notification not found")
    db.session.delete(notification)
    db.session.commit()
    return True


def recent_for_user(user, limit=5):
    rows = (
        Notification.query.filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .all()
    )
    return [row.to_dict() for row in rows]


def student_ids_for_parent(parent):
    return [link.student_id for link in parent.student_links]


def resolve_student(student_id):
    student = db.session.get(Student, int(student_id))
    if student is None:
        raise NotFound("Student not found")
    return student
