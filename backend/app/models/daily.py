"""Official daily records: attendance, health, meals, school and activities.

Only ADMIN users may create or modify anything in this module - the route layer
enforces that. Parents and students read these records.
"""

from ..constants import (
    ActivityType,
    AttendanceSession,
    AttendanceStatus,
    HealthSeverity,
    HealthStatus,
    MealType,
    RecoveryStatus,
    SchoolAttendanceStatus,
)
from ..extensions import db
from .base import TimestampMixin, enum_column, iso, utcnow


class AttendanceRecord(TimestampMixin, db.Model):
    __tablename__ = "attendance"
    __table_args__ = (
        db.UniqueConstraint(
            "student_id", "date", "session", name="uq_attendance_student_id_date_session"
        ),
        db.Index("ix_attendance_date_status", "date", "status"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = db.Column(db.Date, nullable=False, index=True)
    session = enum_column(
        AttendanceSession, "attendance_session", nullable=False, default=AttendanceSession.MORNING
    )
    status = enum_column(AttendanceStatus, "attendance_status", nullable=False)
    marked_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    marked_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    remarks = db.Column(db.Text, nullable=True)

    student = db.relationship("Student", back_populates="attendance_records")
    marked_by = db.relationship("User")

    def to_dict(self, include_student=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "date": iso(self.date),
            "session": iso(self.session),
            "status": iso(self.status),
            "marked_at": iso(self.marked_at),
            "marked_by": self.marked_by.full_name if self.marked_by else "System",
            "marked_by_id": self.marked_by_id,
            "remarks": self.remarks,
            **self.timestamps,
        }
        if include_student and self.student:
            data["student"] = self.student.to_summary()
        return data


class HealthRecord(TimestampMixin, db.Model):
    __tablename__ = "health_records"
    __table_args__ = (db.Index("ix_health_records_student_recorded", "student_id", "recorded_at"),)

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = enum_column(HealthStatus, "health_status", nullable=False, index=True)
    severity = enum_column(
        HealthSeverity, "health_severity", nullable=False, default=HealthSeverity.LOW
    )
    symptoms = db.Column(db.Text, nullable=True)
    temperature = db.Column(db.Numeric(4, 1), nullable=True)
    description = db.Column(db.Text, nullable=True)
    medicine_given = db.Column(db.Text, nullable=True)
    doctor_visited = db.Column(db.Boolean, nullable=False, default=False)
    doctor_name = db.Column(db.String(150), nullable=True)
    hospital_visit = db.Column(db.Boolean, nullable=False, default=False)
    hospital_name = db.Column(db.String(150), nullable=True)
    medical_remarks = db.Column(db.Text, nullable=True)
    recovery_status = enum_column(
        RecoveryStatus, "health_recovery_status", nullable=False, default=RecoveryStatus.ONGOING
    )
    recovered_at = db.Column(db.DateTime, nullable=True)
    recorded_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)
    recorded_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    student = db.relationship("Student", back_populates="health_records")
    recorded_by = db.relationship("User")

    @property
    def is_urgent(self):
        return self.status in (
            HealthStatus.HOSPITALIZED,
            HealthStatus.MEDICAL_OBSERVATION,
        ) or self.severity in (HealthSeverity.HIGH, HealthSeverity.CRITICAL)

    def to_dict(self, include_student=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "status": iso(self.status),
            "severity": iso(self.severity),
            "symptoms": self.symptoms,
            "temperature": iso(self.temperature),
            "description": self.description,
            "medicine_given": self.medicine_given,
            "doctor_visited": self.doctor_visited,
            "doctor_name": self.doctor_name,
            "hospital_visit": self.hospital_visit,
            "hospital_name": self.hospital_name,
            "medical_remarks": self.medical_remarks,
            "recovery_status": iso(self.recovery_status),
            "recovered_at": iso(self.recovered_at),
            "recorded_at": iso(self.recorded_at),
            "date": iso(self.recorded_at.date()) if self.recorded_at else None,
            "recorded_by": self.recorded_by.full_name if self.recorded_by else "System",
            "is_urgent": self.is_urgent,
            **self.timestamps,
        }
        if include_student and self.student:
            data["student"] = self.student.to_summary()
        return data


class Meal(TimestampMixin, db.Model):
    """One meal served on a given day (hostel-wide, not per student)."""

    __tablename__ = "meals"
    __table_args__ = (
        db.UniqueConstraint("date", "meal_type", name="uq_meals_date_meal_type"),
    )

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)
    meal_type = enum_column(MealType, "meal_type", nullable=False)
    name = db.Column(db.String(120), nullable=True)
    food_items = db.Column(db.Text, nullable=True)  # newline separated list
    served_at = db.Column(db.Time, nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_by = db.relationship("User")
    photos = db.relationship(
        "MealPhoto", back_populates="meal", cascade="all, delete-orphan", order_by="MealPhoto.id"
    )

    @property
    def item_list(self):
        if not self.food_items:
            return []
        return [item.strip() for item in self.food_items.splitlines() if item.strip()]

    def to_dict(self):
        return {
            "id": self.id,
            "date": iso(self.date),
            "meal_type": iso(self.meal_type),
            "name": self.name,
            "food_items": self.item_list,
            "served_at": iso(self.served_at),
            "remarks": self.remarks,
            "created_by": self.created_by.full_name if self.created_by else "System",
            "photos": [photo.to_dict() for photo in self.photos],
            **self.timestamps,
        }


class MealPhoto(db.Model):
    __tablename__ = "meal_photos"

    id = db.Column(db.Integer, primary_key=True)
    meal_id = db.Column(
        db.Integer, db.ForeignKey("meals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_path = db.Column(db.String(255), nullable=False)
    caption = db.Column(db.String(255), nullable=True)
    uploaded_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    meal = db.relationship("Meal", back_populates="photos")

    def to_dict(self):
        return {
            "id": self.id,
            "meal_id": self.meal_id,
            "file_path": self.file_path,
            "caption": self.caption,
            "uploaded_at": iso(self.uploaded_at),
        }


class SchoolAttendance(TimestampMixin, db.Model):
    __tablename__ = "school_attendance"
    __table_args__ = (
        db.UniqueConstraint("student_id", "date", name="uq_school_attendance_student_id_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = db.Column(db.Date, nullable=False, index=True)
    status = enum_column(SchoolAttendanceStatus, "school_attendance_status", nullable=False)
    departure_time = db.Column(db.Time, nullable=True)
    expected_return_time = db.Column(db.Time, nullable=True)
    actual_return_time = db.Column(db.Time, nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    recorded_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    student = db.relationship("Student", back_populates="school_attendance_records")
    recorded_by = db.relationship("User")

    def to_dict(self, include_student=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "date": iso(self.date),
            "status": iso(self.status),
            "departure_time": iso(self.departure_time),
            "expected_return_time": iso(self.expected_return_time),
            "actual_return_time": iso(self.actual_return_time),
            "remarks": self.remarks,
            "recorded_by": self.recorded_by.full_name if self.recorded_by else "System",
            **self.timestamps,
        }
        if include_student and self.student:
            data["student"] = self.student.to_summary()
        return data


class DailyActivity(TimestampMixin, db.Model):
    """A single entry on a student's daily timeline."""

    __tablename__ = "daily_activities"
    __table_args__ = (
        db.Index("ix_daily_activities_student_date", "student_id", "date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date = db.Column(db.Date, nullable=False, index=True)
    activity_type = enum_column(ActivityType, "activity_type", nullable=False)
    title = db.Column(db.String(150), nullable=False)
    scheduled_time = db.Column(db.Time, nullable=True)
    activity_time = db.Column(db.Time, nullable=True)
    is_completed = db.Column(db.Boolean, nullable=False, default=False)
    # Students with their own account may confirm (but never author) activities.
    confirmed_by_student = db.Column(db.Boolean, nullable=False, default=False)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    recorded_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    student = db.relationship("Student", back_populates="daily_activities")
    recorded_by = db.relationship("User")

    def to_dict(self, include_student=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "date": iso(self.date),
            "activity_type": iso(self.activity_type),
            "title": self.title,
            "scheduled_time": iso(self.scheduled_time),
            "activity_time": iso(self.activity_time),
            "is_completed": self.is_completed,
            "confirmed_by_student": self.confirmed_by_student,
            "confirmed_at": iso(self.confirmed_at),
            "remarks": self.remarks,
            "recorded_by": self.recorded_by.full_name if self.recorded_by else "System",
            **self.timestamps,
        }
        if include_student and self.student:
            data["student"] = self.student.to_summary()
        return data
