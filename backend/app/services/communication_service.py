"""Suggestions, announcements and emergency alerts."""

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from ..constants import (
    AnnouncementAudience,
    AuditAction,
    EmergencyAudience,
    NotificationPriority,
    NotificationType,
    SuggestionCategory,
    SuggestionSource,
    SuggestionStatus,
    UserRole,
    VerificationStatus,
)
from ..extensions import db
from ..models import (
    Announcement,
    EmergencyAlert,
    EmergencyAlertRecipient,
    Parent,
    Student,
    StudentParent,
    Suggestion,
    SuggestionReply,
    User,
)
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.errors import BusinessRuleViolation, NotFound, PermissionDenied
from ..utils.pagination import paginate_query
from ..utils.storage import save_document
from . import notification_service


# ---------------------------------------------------------------------------
# Suggestions / feedback (user generated - never an official record)
# ---------------------------------------------------------------------------
def get_suggestion(suggestion_id):
    suggestion = db.session.get(Suggestion, int(suggestion_id))
    if suggestion is None:
        raise NotFound("Suggestion not found")
    return suggestion


def list_suggestions(filters, page=None, per_page=None, parent_id=None, author_id=None):
    query = Suggestion.query.options(
        joinedload(Suggestion.student),
        joinedload(Suggestion.created_by),
        joinedload(Suggestion.replies),
    )
    if parent_id is not None:
        query = query.filter(Suggestion.parent_id == parent_id)
    if author_id is not None:
        query = query.filter(Suggestion.created_by_id == author_id)

    status = SuggestionStatus.coerce(filters.get("status"))
    if status:
        query = query.filter(Suggestion.status == status)
    category = SuggestionCategory.coerce(filters.get("category"))
    if category:
        query = query.filter(Suggestion.category == category)
    if filters.get("student_id"):
        query = query.filter(Suggestion.student_id == int(filters["student_id"]))
    search = (filters.get("q") or "").strip()
    if search:
        pattern = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Suggestion.subject).like(pattern),
                func.lower(Suggestion.message).like(pattern),
            )
        )
    query = query.order_by(Suggestion.created_at.desc(), Suggestion.id.desc())
    return paginate_query(query, page, per_page, serializer=lambda s: s.to_dict())


def create_suggestion(data, author, parent=None, file_storage=None, source=None):
    student_id = data.get("student_id")
    if parent is not None:
        if parent.verification_status != VerificationStatus.VERIFIED:
            raise PermissionDenied("Your account is awaiting administrator verification.")
        allowed_ids = {link.student_id for link in parent.student_links}
        if student_id and int(student_id) not in allowed_ids:
            raise PermissionDenied("You may only raise suggestions about your own child.")
        if not student_id and len(allowed_ids) == 1:
            student_id = next(iter(allowed_ids))
    elif author.is_student:
        profile = author.student_profile
        student_id = profile.id if profile else None

    suggestion = Suggestion(
        parent_id=parent.id if parent else None,
        created_by_id=author.id,
        source=source or (SuggestionSource.PARENT if parent else SuggestionSource.STUDENT),
        student_id=int(student_id) if student_id else None,
        subject=data["subject"],
        category=data.get("category") or SuggestionCategory.GENERAL,
        message=data["message"],
        status=SuggestionStatus.NEW,
    )
    if file_storage is not None and getattr(file_storage, "filename", ""):
        suggestion.attachment = save_document(file_storage, "suggestions", field="attachment")
    db.session.add(suggestion)
    db.session.flush()

    notification_service.notify_admins(
        NotificationType.GENERAL,
        f"New {suggestion.category.value.title()} suggestion",
        f"{author.full_name}: {suggestion.subject}",
        student_id=suggestion.student_id,
        priority=NotificationPriority.NORMAL,
        link="/admin/suggestions",
        created_by=author,
    )
    db.session.commit()
    return suggestion


def update_suggestion_status(suggestion, status, actor=None):
    suggestion.status = status
    suggestion.resolved_at = utcnow() if status == SuggestionStatus.RESOLVED else None
    record_audit(
        AuditAction.SUGGESTION_UPDATED,
        actor=actor,
        entity_type="suggestion",
        entity_id=suggestion.id,
        description=f"Suggestion '{suggestion.subject}' set to {status.value}",
    )
    if suggestion.created_by:
        notification_service.notify_user(
            suggestion.created_by,
            NotificationType.SUGGESTION_REPLY,
            "Suggestion status updated",
            f"Your suggestion '{suggestion.subject}' is now marked "
            f"{status.value.replace('_', ' ').title()}.",
            student_id=suggestion.student_id,
            priority=NotificationPriority.NORMAL,
            link="/parent/suggestions",
            created_by=actor,
        )
    db.session.commit()
    return suggestion


def reply_to_suggestion(suggestion, message, author):
    reply = SuggestionReply(
        suggestion_id=suggestion.id, author_id=author.id, message=message
    )
    db.session.add(reply)
    if author.is_admin and suggestion.status == SuggestionStatus.NEW:
        suggestion.status = SuggestionStatus.UNDER_REVIEW

    # Notify the other side of the conversation.
    if author.is_admin:
        recipient = suggestion.created_by
        title = "Reply from the hostel administration"
        link = "/parent/suggestions" if suggestion.source == SuggestionSource.PARENT else "/student/notifications"
    else:
        recipient = None
        notification_service.notify_admins(
            NotificationType.SUGGESTION_REPLY,
            "New reply on a suggestion",
            f"{author.full_name} replied to '{suggestion.subject}'.",
            student_id=suggestion.student_id,
            link="/admin/suggestions",
            created_by=author,
        )
        title = None
        link = None

    if recipient is not None and recipient.id != author.id:
        notification_service.notify_user(
            recipient,
            NotificationType.SUGGESTION_REPLY,
            title,
            f"Re: {suggestion.subject}\n\n{message}",
            student_id=suggestion.student_id,
            priority=NotificationPriority.NORMAL,
            link=link,
            created_by=author,
        )

    if author.is_admin:
        record_audit(
            AuditAction.SUGGESTION_REPLIED,
            actor=author,
            entity_type="suggestion",
            entity_id=suggestion.id,
            description=f"Replied to suggestion '{suggestion.subject}'",
        )
    db.session.commit()
    return reply


def suggestion_stats():
    rows = db.session.execute(
        select(Suggestion.status, func.count(Suggestion.id)).group_by(Suggestion.status)
    ).all()
    counts = {status.value: 0 for status in SuggestionStatus}
    for status, total in rows:
        counts[status.value] = total
    counts["TOTAL"] = sum(counts.values())
    counts["OPEN"] = (
        counts[SuggestionStatus.NEW.value]
        + counts[SuggestionStatus.UNDER_REVIEW.value]
        + counts[SuggestionStatus.IN_PROGRESS.value]
    )
    return counts


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------
def get_announcement(announcement_id):
    announcement = db.session.get(Announcement, int(announcement_id))
    if announcement is None:
        raise NotFound("Announcement not found")
    return announcement


def list_announcements(filters, page=None, per_page=None):
    query = Announcement.query.options(joinedload(Announcement.target_student))
    if filters.get("active_only"):
        query = query.filter(Announcement.is_active.is_(True))
    audience = AnnouncementAudience.coerce(filters.get("audience"))
    if audience:
        query = query.filter(Announcement.audience == audience)
    search = (filters.get("q") or "").strip()
    if search:
        pattern = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Announcement.title).like(pattern),
                func.lower(Announcement.description).like(pattern),
            )
        )
    query = query.order_by(Announcement.created_at.desc())
    return paginate_query(query, page, per_page, serializer=lambda a: a.to_dict())


def announcements_for_user(user, limit=20):
    """Announcements visible to a specific parent or student."""
    today = date.today()
    query = Announcement.query.filter(Announcement.is_active.is_(True)).filter(
        or_(Announcement.start_date.is_(None), Announcement.start_date <= today),
        or_(Announcement.end_date.is_(None), Announcement.end_date >= today),
    )

    if user.is_admin:
        pass
    elif user.is_parent:
        profile = user.parent_profile
        child_ids = [link.student_id for link in profile.student_links] if profile else []
        classes = [
            link.student.student_class
            for link in (profile.student_links if profile else [])
            if link.student and link.student.student_class
        ]
        conditions = [
            Announcement.audience == AnnouncementAudience.ALL_PARENTS,
            Announcement.audience == AnnouncementAudience.EVERYONE,
        ]
        if child_ids:
            conditions.append(
                (Announcement.audience == AnnouncementAudience.SPECIFIC_STUDENT)
                & Announcement.target_student_id.in_(child_ids)
            )
        if classes:
            conditions.append(
                (Announcement.audience == AnnouncementAudience.SPECIFIC_CLASS)
                & Announcement.target_class.in_(classes)
            )
        query = query.filter(or_(*conditions))
    elif user.is_student:
        profile = user.student_profile
        conditions = [
            Announcement.audience == AnnouncementAudience.ALL_STUDENTS,
            Announcement.audience == AnnouncementAudience.EVERYONE,
        ]
        if profile:
            conditions.append(
                (Announcement.audience == AnnouncementAudience.SPECIFIC_STUDENT)
                & (Announcement.target_student_id == profile.id)
            )
            if profile.student_class:
                conditions.append(
                    (Announcement.audience == AnnouncementAudience.SPECIFIC_CLASS)
                    & (Announcement.target_class == profile.student_class)
                )
        query = query.filter(or_(*conditions))

    rows = query.order_by(Announcement.created_at.desc()).limit(limit).all()
    return [row.to_dict() for row in rows]


def _announcement_recipient_ids(announcement):
    audience = announcement.audience
    if audience == AnnouncementAudience.ALL_PARENTS:
        return db.session.execute(
            select(User.id)
            .join(Parent, Parent.user_id == User.id)
            .where(Parent.verification_status == VerificationStatus.VERIFIED)
        ).scalars().all()
    if audience == AnnouncementAudience.ALL_STUDENTS:
        return db.session.execute(
            select(User.id).where(User.role == UserRole.STUDENT)
        ).scalars().all()
    if audience == AnnouncementAudience.EVERYONE:
        return db.session.execute(
            select(User.id).where(User.role.in_([UserRole.PARENT, UserRole.STUDENT]))
        ).scalars().all()
    if audience == AnnouncementAudience.SPECIFIC_STUDENT and announcement.target_student_id:
        parent_users = db.session.execute(
            select(User.id)
            .join(Parent, Parent.user_id == User.id)
            .join(StudentParent, StudentParent.parent_id == Parent.id)
            .where(
                StudentParent.student_id == announcement.target_student_id,
                Parent.verification_status == VerificationStatus.VERIFIED,
            )
        ).scalars().all()
        student = db.session.get(Student, announcement.target_student_id)
        if student and student.user_id:
            parent_users = list(parent_users) + [student.user_id]
        return parent_users
    if audience == AnnouncementAudience.SPECIFIC_CLASS and announcement.target_class:
        student_ids = db.session.execute(
            select(Student.id).where(Student.student_class == announcement.target_class)
        ).scalars().all()
        if not student_ids:
            return []
        parent_users = db.session.execute(
            select(User.id)
            .join(Parent, Parent.user_id == User.id)
            .join(StudentParent, StudentParent.parent_id == Parent.id)
            .where(
                StudentParent.student_id.in_(student_ids),
                Parent.verification_status == VerificationStatus.VERIFIED,
            )
        ).scalars().all()
        student_users = db.session.execute(
            select(Student.user_id).where(
                Student.id.in_(student_ids), Student.user_id.isnot(None)
            )
        ).scalars().all()
        return list(set(list(parent_users) + list(student_users)))
    return []


def create_announcement(data, actor=None, file_storage=None):
    announcement = Announcement(
        title=data["title"],
        description=data["description"],
        audience=data["audience"],
        target_student_id=data.get("target_student_id"),
        target_class=data.get("target_class"),
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        is_active=data.get("is_active", True),
        created_by_id=getattr(actor, "id", None),
    )
    if file_storage is not None and getattr(file_storage, "filename", ""):
        announcement.attachment = save_document(
            file_storage, "announcements", field="attachment"
        )
    db.session.add(announcement)
    db.session.flush()

    for user_id in set(_announcement_recipient_ids(announcement)):
        notification_service.create_notification(
            user_id=user_id,
            notification_type=NotificationType.ANNOUNCEMENT,
            title=announcement.title,
            message=announcement.description,
            student_id=announcement.target_student_id,
            priority=NotificationPriority.NORMAL,
            link="/notifications",
            created_by=actor,
        )

    record_audit(
        AuditAction.ANNOUNCEMENT_CREATED,
        actor=actor,
        entity_type="announcement",
        entity_id=announcement.id,
        description=f"Published announcement '{announcement.title}' to "
        f"{announcement.audience.value}",
    )
    db.session.commit()
    return announcement


def update_announcement(announcement, data, actor=None):
    for field in (
        "title",
        "description",
        "audience",
        "target_student_id",
        "target_class",
        "start_date",
        "end_date",
    ):
        if field in data:
            setattr(announcement, field, data[field])
    if "is_active" in data:
        announcement.is_active = bool(data["is_active"])
    record_audit(
        AuditAction.ANNOUNCEMENT_UPDATED,
        actor=actor,
        entity_type="announcement",
        entity_id=announcement.id,
        description=f"Updated announcement '{announcement.title}'",
    )
    db.session.commit()
    return announcement


def delete_announcement(announcement, actor=None):
    title = announcement.title
    announcement_id = announcement.id
    db.session.delete(announcement)
    record_audit(
        AuditAction.ANNOUNCEMENT_UPDATED,
        actor=actor,
        entity_type="announcement",
        entity_id=announcement_id,
        description=f"Deleted announcement '{title}'",
    )
    db.session.commit()
    return True


# ---------------------------------------------------------------------------
# Emergency alerts
# ---------------------------------------------------------------------------
def get_alert(alert_id):
    alert = db.session.get(EmergencyAlert, int(alert_id))
    if alert is None:
        raise NotFound("Emergency alert not found")
    return alert


def list_alerts(filters, page=None, per_page=None):
    query = EmergencyAlert.query.options(joinedload(EmergencyAlert.student))
    if filters.get("active_only"):
        query = query.filter(EmergencyAlert.is_active.is_(True))
    query = query.order_by(EmergencyAlert.created_at.desc())
    return paginate_query(query, page, per_page, serializer=lambda a: a.to_dict())


def _alert_recipient_user_ids(data, audience):
    if audience == EmergencyAudience.ALL_PARENTS:
        return db.session.execute(
            select(User.id)
            .join(Parent, Parent.user_id == User.id)
            .where(Parent.verification_status == VerificationStatus.VERIFIED)
        ).scalars().all()
    if audience == EmergencyAudience.SELECTED_PARENTS:
        parent_ids = [int(pid) for pid in data.get("parent_ids") or []]
        if not parent_ids:
            return []
        return db.session.execute(
            select(User.id)
            .join(Parent, Parent.user_id == User.id)
            .where(Parent.id.in_(parent_ids))
        ).scalars().all()
    if audience == EmergencyAudience.SINGLE_PARENT:
        student_id = data.get("student_id")
        if not student_id:
            return []
        return db.session.execute(
            select(User.id)
            .join(Parent, Parent.user_id == User.id)
            .join(StudentParent, StudentParent.parent_id == Parent.id)
            .where(StudentParent.student_id == int(student_id))
        ).scalars().all()
    return []


def send_emergency_alert(data, actor=None):
    audience = data["audience"]
    recipient_ids = set(_alert_recipient_user_ids(data, audience))
    if not recipient_ids:
        raise BusinessRuleViolation(
            "No verified recipients matched this alert. Check the audience selection."
        )

    alert = EmergencyAlert(
        alert_type=data["alert_type"],
        audience=audience,
        title=data["title"],
        message=data["message"],
        student_id=data.get("student_id"),
        created_by_id=getattr(actor, "id", None),
    )
    db.session.add(alert)
    db.session.flush()

    for user_id in recipient_ids:
        db.session.add(EmergencyAlertRecipient(alert_id=alert.id, user_id=user_id))
        notification_service.create_notification(
            user_id=user_id,
            notification_type=NotificationType.EMERGENCY_ALERT,
            title=f"EMERGENCY: {alert.title}",
            message=alert.message,
            student_id=alert.student_id,
            priority=NotificationPriority.URGENT,
            link="/notifications",
            created_by=actor,
        )

    record_audit(
        AuditAction.EMERGENCY_ALERT_SENT,
        actor=actor,
        entity_type="emergency_alert",
        entity_id=alert.id,
        description=f"Sent {alert.alert_type.value} alert '{alert.title}' to "
        f"{len(recipient_ids)} recipient(s)",
    )
    db.session.commit()
    return alert


def resolve_alert(alert, actor=None):
    alert.is_active = False
    alert.resolved_at = utcnow()
    record_audit(
        AuditAction.EMERGENCY_ALERT_SENT,
        actor=actor,
        entity_type="emergency_alert",
        entity_id=alert.id,
        description=f"Resolved emergency alert '{alert.title}'",
    )
    db.session.commit()
    return alert


def acknowledge_alert(alert_id, user):
    recipient = db.session.execute(
        select(EmergencyAlertRecipient).where(
            EmergencyAlertRecipient.alert_id == int(alert_id),
            EmergencyAlertRecipient.user_id == user.id,
        )
    ).scalars().first()
    if recipient is None:
        raise NotFound("Emergency alert not found")
    if recipient.acknowledged_at is None:
        recipient.acknowledged_at = utcnow()
        db.session.commit()
    return recipient


def active_alerts_for_user(user):
    rows = (
        EmergencyAlert.query.join(
            EmergencyAlertRecipient, EmergencyAlertRecipient.alert_id == EmergencyAlert.id
        )
        .filter(
            EmergencyAlertRecipient.user_id == user.id,
            EmergencyAlert.is_active.is_(True),
        )
        .order_by(EmergencyAlert.created_at.desc())
        .all()
    )
    return [row.to_dict() for row in rows]


def active_alert_count():
    return (
        db.session.execute(
            select(func.count(EmergencyAlert.id)).where(EmergencyAlert.is_active.is_(True))
        ).scalar()
        or 0
    )
