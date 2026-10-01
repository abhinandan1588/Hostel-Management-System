"""Student profile - the centre of the domain model."""

from ..constants import Gender, StudentStatus, VerificationStatus
from ..extensions import db
from .base import TimestampMixin, enum_column, iso, utcnow


class Student(TimestampMixin, db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    # Optional login account - only students who own a phone get one.
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    student_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(150), nullable=False, index=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    gender = enum_column(Gender, "student_gender", nullable=True)
    blood_group = db.Column(db.String(10), nullable=True)
    student_class = db.Column(db.String(40), nullable=True, index=True)
    section = db.Column(db.String(20), nullable=True)
    school_name = db.Column(db.String(150), nullable=True, index=True)
    phone = db.Column(db.String(25), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    admission_date = db.Column(db.Date, nullable=True)
    profile_photo = db.Column(db.String(255), nullable=True)

    emergency_contact_name = db.Column(db.String(150), nullable=True)
    emergency_contact_phone = db.Column(db.String(25), nullable=True)
    emergency_contact_relation = db.Column(db.String(50), nullable=True)

    bed_id = db.Column(
        db.Integer, db.ForeignKey("beds.id", ondelete="SET NULL"), unique=True, nullable=True
    )

    verification_status = enum_column(
        VerificationStatus,
        "student_verification_status",
        nullable=False,
        default=VerificationStatus.PENDING,
        index=True,
    )
    verified_at = db.Column(db.DateTime, nullable=True)
    verified_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    current_status = enum_column(
        StudentStatus,
        "student_current_status",
        nullable=False,
        default=StudentStatus.IN_HOSTEL,
        index=True,
    )
    status_updated_at = db.Column(db.DateTime, nullable=True, default=utcnow)

    # Soft-delete: important records are preserved, the student is deactivated.
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    user = db.relationship("User", back_populates="student_profile", foreign_keys=[user_id])
    verified_by = db.relationship("User", foreign_keys=[verified_by_id])
    bed = db.relationship("Bed", back_populates="student")
    parent_links = db.relationship(
        "StudentParent", back_populates="student", cascade="all, delete-orphan"
    )
    attendance_records = db.relationship(
        "AttendanceRecord", back_populates="student", cascade="all, delete-orphan"
    )
    health_records = db.relationship(
        "HealthRecord", back_populates="student", cascade="all, delete-orphan"
    )
    school_attendance_records = db.relationship(
        "SchoolAttendance", back_populates="student", cascade="all, delete-orphan"
    )
    daily_activities = db.relationship(
        "DailyActivity", back_populates="student", cascade="all, delete-orphan"
    )
    status_history = db.relationship(
        "StudentStatusHistory", back_populates="student", cascade="all, delete-orphan"
    )
    academic_records = db.relationship(
        "AcademicProgress", back_populates="student", cascade="all, delete-orphan"
    )
    progress_records = db.relationship(
        "ProgressRecord", back_populates="student", cascade="all, delete-orphan"
    )

    # --- convenience ------------------------------------------------------
    @property
    def parents(self):
        return [link.parent for link in self.parent_links if link.parent is not None]

    @property
    def parent_ids(self):
        return [link.parent_id for link in self.parent_links]

    @property
    def primary_parent(self):
        for link in self.parent_links:
            if link.is_primary and link.parent is not None:
                return link.parent
        parents = self.parents
        return parents[0] if parents else None

    @property
    def room(self):
        return self.bed.room if self.bed else None

    @property
    def has_login(self):
        return self.user_id is not None

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        today = utcnow().date()
        born = self.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    def room_label(self):
        room = self.room
        if not room:
            return None
        return f"{room.room_number}"

    def hostel_info(self):
        room = self.room
        return {
            "bed_id": self.bed_id,
            "bed_number": self.bed.bed_number if self.bed else None,
            "room_id": room.id if room else None,
            "room_number": room.room_number if room else None,
            "floor": room.floor if room else None,
            "building": room.building if room else None,
            "room_label": room.label if room else None,
        }

    def to_summary(self):
        """Compact representation used in lists, selectors and nested payloads."""
        return {
            "id": self.id,
            "student_code": self.student_code,
            "full_name": self.full_name,
            "student_class": self.student_class,
            "section": self.section,
            "school_name": self.school_name,
            "profile_photo": self.profile_photo,
            "gender": iso(self.gender),
            "current_status": iso(self.current_status),
            "verification_status": iso(self.verification_status),
            "is_active": self.is_active,
            "has_login": self.has_login,
            "room_number": self.room.room_number if self.room else None,
            "bed_number": self.bed.bed_number if self.bed else None,
        }

    def to_dict(self, include_parents=True, include_account=True):
        data = {
            **self.to_summary(),
            "date_of_birth": iso(self.date_of_birth),
            "age": self.age,
            "blood_group": self.blood_group,
            "phone": self.phone,
            "email": self.email,
            "admission_date": iso(self.admission_date),
            "emergency_contact": {
                "name": self.emergency_contact_name,
                "phone": self.emergency_contact_phone,
                "relation": self.emergency_contact_relation,
            },
            "hostel": self.hostel_info(),
            "status_updated_at": iso(self.status_updated_at),
            "verified_at": iso(self.verified_at),
            "notes": self.notes,
            "archived_at": iso(self.archived_at),
            **self.timestamps,
        }
        if include_account:
            data["account"] = (
                {
                    "user_id": self.user.id,
                    "email": self.user.email,
                    "username": self.user.username,
                    "account_status": iso(self.user.account_status),
                }
                if self.user
                else None
            )
        if include_parents:
            data["parents"] = [
                {
                    "parent_id": link.parent_id,
                    "student_parent_id": link.id,
                    "full_name": link.parent.user.full_name if link.parent.user else None,
                    "phone": link.parent.user.phone if link.parent.user else None,
                    "email": link.parent.user.email if link.parent.user else None,
                    "relationship_type": link.relationship_type
                    or link.parent.relationship_to_student,
                    "is_primary": link.is_primary,
                    "verification_status": iso(link.parent.verification_status),
                }
                for link in self.parent_links
                if link.parent is not None
            ]
        return data

    def __repr__(self):
        return f"<Student {self.id} {self.student_code} {self.full_name}>"


class StudentStatusHistory(db.Model):
    """Audit trail of consent-based activity status changes."""

    __tablename__ = "student_status_history"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = enum_column(StudentStatus, "status_history_status", nullable=False)
    changed_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)
    updated_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    remarks = db.Column(db.Text, nullable=True)

    student = db.relationship("Student", back_populates="status_history")
    updated_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "status": iso(self.status),
            "changed_at": iso(self.changed_at),
            "date": iso(self.changed_at.date()) if self.changed_at else None,
            "updated_by": self.updated_by.full_name if self.updated_by else "System",
            "remarks": self.remarks,
        }
