"""User accounts, admin profiles, auth tokens and audit trail."""

from werkzeug.security import check_password_hash, generate_password_hash

from ..constants import AccountStatus, UserRole
from ..extensions import db
from .base import TimestampMixin, enum_column, iso, utcnow


class User(TimestampMixin, db.Model):
    """Single identity table for every role (ADMIN / PARENT / STUDENT)."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=True, index=True)
    phone = db.Column(db.String(25), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = enum_column(UserRole, "user_role", nullable=False, index=True)
    account_status = enum_column(
        AccountStatus,
        "account_status",
        nullable=False,
        default=AccountStatus.PENDING_VERIFICATION,
        index=True,
    )
    profile_photo = db.Column(db.String(255), nullable=True)
    is_email_verified = db.Column(db.Boolean, nullable=False, default=False)
    is_super_admin = db.Column(db.Boolean, nullable=False, default=False)
    failed_login_attempts = db.Column(db.Integer, nullable=False, default=0)
    last_login_at = db.Column(db.DateTime, nullable=True)
    password_changed_at = db.Column(db.DateTime, nullable=True)

    parent_profile = db.relationship(
        "Parent",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="Parent.user_id",
    )
    student_profile = db.relationship(
        "Student", back_populates="user", uselist=False, foreign_keys="Student.user_id"
    )
    admin_profile = db.relationship(
        "AdminProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    notifications = db.relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Notification.user_id",
    )

    # --- password handling ------------------------------------------------
    def set_password(self, raw_password):
        method = "pbkdf2:sha256:600000"
        try:
            from flask import current_app

            method = current_app.config.get("PASSWORD_HASH_METHOD", method)
        except RuntimeError:  # outside an application context
            pass
        self.password_hash = generate_password_hash(raw_password, method=method)
        self.password_changed_at = utcnow()

    def check_password(self, raw_password):
        if not raw_password or not self.password_hash:
            return False
        return check_password_hash(self.password_hash, raw_password)

    # --- state helpers ----------------------------------------------------
    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN

    @property
    def is_parent(self):
        return self.role == UserRole.PARENT

    @property
    def is_student(self):
        return self.role == UserRole.STUDENT

    @property
    def is_active_account(self):
        return self.account_status == AccountStatus.ACTIVE

    def can_login(self):
        """Blocked / rejected / inactive accounts may never authenticate.

        Parents awaiting verification *can* sign in but land on a restricted
        screen; the API refuses to hand them any child data until verified.
        """
        if self.account_status in (
            AccountStatus.BLOCKED,
            AccountStatus.REJECTED,
            AccountStatus.INACTIVE,
        ):
            return False
        return True

    def to_dict(self, include_email=True):
        data = {
            "id": self.id,
            "full_name": self.full_name,
            "username": self.username,
            "role": iso(self.role),
            "account_status": iso(self.account_status),
            "profile_photo": self.profile_photo,
            "is_email_verified": self.is_email_verified,
            "is_super_admin": self.is_super_admin,
            "last_login_at": iso(self.last_login_at),
            **self.timestamps,
        }
        if include_email:
            data["email"] = self.email
            data["phone"] = self.phone
        return data

    def __repr__(self):
        return f"<User {self.id} {self.email} {self.role}>"


class AdminProfile(TimestampMixin, db.Model):
    """Administrator specific settings (notification preferences, title)."""

    __tablename__ = "admin_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    designation = db.Column(db.String(100), nullable=True)
    hostel_name = db.Column(db.String(150), nullable=True)
    notify_email = db.Column(db.Boolean, nullable=False, default=True)
    notify_health_alerts = db.Column(db.Boolean, nullable=False, default=True)
    notify_new_registrations = db.Column(db.Boolean, nullable=False, default=True)
    notify_suggestions = db.Column(db.Boolean, nullable=False, default=True)

    user = db.relationship("User", back_populates="admin_profile")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "designation": self.designation,
            "hostel_name": self.hostel_name,
            "notification_settings": {
                "email": self.notify_email,
                "health_alerts": self.notify_health_alerts,
                "new_registrations": self.notify_new_registrations,
                "suggestions": self.notify_suggestions,
            },
            **self.timestamps,
        }


class PasswordResetToken(db.Model):
    """Single-use, hashed password-reset token."""

    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash = db.Column(db.String(128), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    requested_ip = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    user = db.relationship("User")

    @property
    def is_expired(self):
        return utcnow() >= self.expires_at

    @property
    def is_usable(self):
        return self.used_at is None and not self.is_expired


class TokenBlocklist(db.Model):
    """Revoked JWTs (logout / forced sign-out)."""

    __tablename__ = "token_blocklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(64), nullable=False, unique=True, index=True)
    token_type = db.Column(db.String(20), nullable=False, default="access")
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    revoked_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)


class AuditLog(db.Model):
    """Append-only record of every significant administrative action."""

    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    admin_name = db.Column(db.String(150), nullable=True)
    action = db.Column(db.String(60), nullable=False, index=True)
    entity_type = db.Column(db.String(60), nullable=True, index=True)
    entity_id = db.Column(db.Integer, nullable=True)
    affected_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    affected_user_name = db.Column(db.String(150), nullable=True)
    description = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    admin = db.relationship("User", foreign_keys=[admin_id])
    affected_user = db.relationship("User", foreign_keys=[affected_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "admin_id": self.admin_id,
            "admin_name": self.admin_name,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "affected_user_id": self.affected_user_id,
            "affected_user_name": self.affected_user_name,
            "description": self.description,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": iso(self.created_at),
        }
