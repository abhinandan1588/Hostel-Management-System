"""Parent/guardian profile and the student<->parent association."""

from ..constants import VerificationStatus
from ..extensions import db
from .base import TimestampMixin, enum_column, iso


class StudentParent(TimestampMixin, db.Model):
    """Link table so a student can have several guardians and vice-versa."""

    __tablename__ = "student_parent"
    __table_args__ = (
        db.UniqueConstraint("student_id", "parent_id", name="uq_student_parent_student_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id = db.Column(
        db.Integer, db.ForeignKey("parents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relationship_type = db.Column(db.String(50), nullable=True)
    is_primary = db.Column(db.Boolean, nullable=False, default=False)

    student = db.relationship("Student", back_populates="parent_links")
    parent = db.relationship("Parent", back_populates="student_links")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "parent_id": self.parent_id,
            "relationship_type": self.relationship_type,
            "is_primary": self.is_primary,
        }


class Parent(TimestampMixin, db.Model):
    __tablename__ = "parents"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    address = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(80), nullable=True)
    relationship_to_student = db.Column(db.String(50), nullable=True)
    occupation = db.Column(db.String(100), nullable=True)
    alternate_phone = db.Column(db.String(25), nullable=True)
    identity_document = db.Column(db.String(255), nullable=True)
    # Admission/registration ID typed at signup, used by admin to match a student.
    claimed_student_code = db.Column(db.String(50), nullable=True, index=True)
    verification_status = enum_column(
        VerificationStatus,
        "parent_verification_status",
        nullable=False,
        default=VerificationStatus.PENDING,
        index=True,
    )
    verified_at = db.Column(db.DateTime, nullable=True)
    verified_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rejection_reason = db.Column(db.Text, nullable=True)
    notify_email = db.Column(db.Boolean, nullable=False, default=True)

    user = db.relationship("User", back_populates="parent_profile", foreign_keys=[user_id])
    verified_by = db.relationship("User", foreign_keys=[verified_by_id])
    student_links = db.relationship(
        "StudentParent", back_populates="parent", cascade="all, delete-orphan"
    )
    suggestions = db.relationship(
        "Suggestion", back_populates="parent", cascade="all, delete-orphan"
    )

    @property
    def is_verified(self):
        return self.verification_status == VerificationStatus.VERIFIED

    @property
    def children(self):
        return [link.student for link in self.student_links if link.student is not None]

    @property
    def child_ids(self):
        return [link.student_id for link in self.student_links]

    def to_dict(self, include_children=False, include_documents=False):
        user = self.user
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "full_name": user.full_name if user else None,
            "email": user.email if user else None,
            "phone": user.phone if user else None,
            "profile_photo": user.profile_photo if user else None,
            "account_status": iso(user.account_status) if user else None,
            "address": self.address,
            "city": self.city,
            "relationship_to_student": self.relationship_to_student,
            "occupation": self.occupation,
            "alternate_phone": self.alternate_phone,
            "claimed_student_code": self.claimed_student_code,
            "verification_status": iso(self.verification_status),
            "verified_at": iso(self.verified_at),
            "rejection_reason": self.rejection_reason,
            "notify_email": self.notify_email,
            "children_count": len(self.student_links),
            "registered_at": iso(self.created_at),
            **self.timestamps,
        }
        if include_documents:
            data["identity_document"] = self.identity_document
        if include_children:
            data["children"] = [
                {
                    **link.student.to_summary(),
                    "relationship_type": link.relationship_type,
                    "is_primary": link.is_primary,
                }
                for link in self.student_links
                if link.student is not None
            ]
        return data
