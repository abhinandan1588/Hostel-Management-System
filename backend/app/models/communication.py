"""Notifications, announcements, suggestions and emergency alerts."""

from ..constants import (
    AnnouncementAudience,
    EmergencyAlertType,
    EmergencyAudience,
    NotificationPriority,
    NotificationType,
    SuggestionCategory,
    SuggestionSource,
    SuggestionStatus,
)
from ..extensions import db
from .base import TimestampMixin, enum_column, iso, utcnow


class Notification(db.Model):
    __tablename__ = "notifications"
    __table_args__ = (db.Index("ix_notifications_user_read", "user_id", "is_read"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    type = enum_column(NotificationType, "notification_type", nullable=False, index=True)
    priority = enum_column(
        NotificationPriority,
        "notification_priority",
        nullable=False,
        default=NotificationPriority.NORMAL,
    )
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    link = db.Column(db.String(255), nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False, index=True)
    read_at = db.Column(db.DateTime, nullable=True)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    user = db.relationship("User", back_populates="notifications", foreign_keys=[user_id])
    student = db.relationship("Student")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "student_id": self.student_id,
            "student_name": self.student.full_name if self.student else None,
            "type": iso(self.type),
            "priority": iso(self.priority),
            "title": self.title,
            "message": self.message,
            "link": self.link,
            "is_read": self.is_read,
            "read_at": iso(self.read_at),
            "created_at": iso(self.created_at),
        }


class Announcement(TimestampMixin, db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=False)
    audience = enum_column(AnnouncementAudience, "announcement_audience", nullable=False)
    target_student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="SET NULL"), nullable=True
    )
    target_class = db.Column(db.String(40), nullable=True)
    attachment = db.Column(db.String(255), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    target_student = db.relationship("Student")
    created_by = db.relationship("User")

    @property
    def is_current(self):
        today = utcnow().date()
        if not self.is_active:
            return False
        if self.start_date and today < self.start_date:
            return False
        if self.end_date and today > self.end_date:
            return False
        return True

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "audience": iso(self.audience),
            "target_student_id": self.target_student_id,
            "target_student_name": self.target_student.full_name if self.target_student else None,
            "target_class": self.target_class,
            "attachment": self.attachment,
            "start_date": iso(self.start_date),
            "end_date": iso(self.end_date),
            "is_active": self.is_active,
            "is_current": self.is_current,
            "created_by": self.created_by.full_name if self.created_by else "Administrator",
            **self.timestamps,
        }


class Suggestion(TimestampMixin, db.Model):
    """Parent (or student) generated feedback - never an official record."""

    __tablename__ = "suggestions"

    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(
        db.Integer, db.ForeignKey("parents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source = enum_column(
        SuggestionSource, "suggestion_source", nullable=False, default=SuggestionSource.PARENT
    )
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    subject = db.Column(db.String(180), nullable=False)
    category = enum_column(SuggestionCategory, "suggestion_category", nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    attachment = db.Column(db.String(255), nullable=True)
    status = enum_column(
        SuggestionStatus,
        "suggestion_status",
        nullable=False,
        default=SuggestionStatus.NEW,
        index=True,
    )
    resolved_at = db.Column(db.DateTime, nullable=True)

    parent = db.relationship("Parent", back_populates="suggestions")
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    student = db.relationship("Student")
    replies = db.relationship(
        "SuggestionReply",
        back_populates="suggestion",
        cascade="all, delete-orphan",
        order_by="SuggestionReply.created_at",
    )

    def to_dict(self, include_replies=True):
        author = self.created_by
        data = {
            "id": self.id,
            "parent_id": self.parent_id,
            "source": iso(self.source),
            "author_name": author.full_name if author else None,
            "author_role": iso(author.role) if author else None,
            "author_phone": author.phone if author else None,
            "author_email": author.email if author else None,
            "student_id": self.student_id,
            "student_name": self.student.full_name if self.student else None,
            "subject": self.subject,
            "category": iso(self.category),
            "message": self.message,
            "attachment": self.attachment,
            "status": iso(self.status),
            "resolved_at": iso(self.resolved_at),
            "reply_count": len(self.replies),
            **self.timestamps,
        }
        if include_replies:
            data["replies"] = [reply.to_dict() for reply in self.replies]
        return data


class SuggestionReply(db.Model):
    __tablename__ = "suggestion_replies"

    id = db.Column(db.Integer, primary_key=True)
    suggestion_id = db.Column(
        db.Integer, db.ForeignKey("suggestions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    suggestion = db.relationship("Suggestion", back_populates="replies")
    author = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "suggestion_id": self.suggestion_id,
            "author_id": self.author_id,
            "author_name": self.author.full_name if self.author else "Administrator",
            "author_role": iso(self.author.role) if self.author else None,
            "message": self.message,
            "created_at": iso(self.created_at),
        }


class EmergencyAlert(TimestampMixin, db.Model):
    __tablename__ = "emergency_alerts"

    id = db.Column(db.Integer, primary_key=True)
    alert_type = enum_column(EmergencyAlertType, "emergency_alert_type", nullable=False)
    audience = enum_column(EmergencyAudience, "emergency_audience", nullable=False)
    title = db.Column(db.String(180), nullable=False)
    message = db.Column(db.Text, nullable=False)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="SET NULL"), nullable=True
    )
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    student = db.relationship("Student")
    created_by = db.relationship("User")
    recipients = db.relationship(
        "EmergencyAlertRecipient", back_populates="alert", cascade="all, delete-orphan"
    )

    def to_dict(self, include_recipients=False):
        data = {
            "id": self.id,
            "alert_type": iso(self.alert_type),
            "audience": iso(self.audience),
            "title": self.title,
            "message": self.message,
            "student_id": self.student_id,
            "student_name": self.student.full_name if self.student else None,
            "is_active": self.is_active,
            "resolved_at": iso(self.resolved_at),
            "created_by": self.created_by.full_name if self.created_by else "Administrator",
            "recipient_count": len(self.recipients),
            "acknowledged_count": sum(
                1 for r in self.recipients if r.acknowledged_at is not None
            ),
            **self.timestamps,
        }
        if include_recipients:
            data["recipients"] = [r.to_dict() for r in self.recipients]
        return data


class EmergencyAlertRecipient(db.Model):
    __tablename__ = "emergency_alert_recipients"
    __table_args__ = (
        db.UniqueConstraint("alert_id", "user_id", name="uq_emergency_alert_recipients_alert_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    alert_id = db.Column(
        db.Integer,
        db.ForeignKey("emergency_alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    acknowledged_at = db.Column(db.DateTime, nullable=True)

    alert = db.relationship("EmergencyAlert", back_populates="recipients")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "alert_id": self.alert_id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
            "acknowledged_at": iso(self.acknowledged_at),
        }
