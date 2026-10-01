"""Academic results and category-based progress scoring."""

from decimal import Decimal

from ..extensions import db
from .base import TimestampMixin, iso, utcnow


class AcademicProgress(TimestampMixin, db.Model):
    __tablename__ = "academic_progress"
    __table_args__ = (
        db.CheckConstraint("max_marks > 0", name="max_marks_positive"),
        db.CheckConstraint("marks_obtained >= 0", name="marks_not_negative"),
        db.Index("ix_academic_progress_student_date", "student_id", "exam_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject = db.Column(db.String(80), nullable=False, index=True)
    exam_name = db.Column(db.String(120), nullable=False)
    exam_type = db.Column(db.String(60), nullable=True)
    marks_obtained = db.Column(db.Numeric(6, 2), nullable=False)
    max_marks = db.Column(db.Numeric(6, 2), nullable=False)
    percentage = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    grade = db.Column(db.String(5), nullable=True)
    teacher_remark = db.Column(db.Text, nullable=True)
    exam_date = db.Column(db.Date, nullable=False, default=lambda: utcnow().date())
    recorded_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    student = db.relationship("Student", back_populates="academic_records")
    recorded_by = db.relationship("User")

    @staticmethod
    def compute_percentage(marks_obtained, max_marks):
        try:
            obtained = Decimal(str(marks_obtained))
            total = Decimal(str(max_marks))
        except (TypeError, ValueError):
            return Decimal("0")
        if total <= 0:
            return Decimal("0")
        return (obtained / total * Decimal("100")).quantize(Decimal("0.01"))

    @staticmethod
    def compute_grade(percentage):
        pct = float(percentage or 0)
        if pct >= 90:
            return "A+"
        if pct >= 80:
            return "A"
        if pct >= 70:
            return "B"
        if pct >= 60:
            return "C"
        if pct >= 50:
            return "D"
        if pct >= 35:
            return "E"
        return "F"

    def recalculate(self):
        self.percentage = self.compute_percentage(self.marks_obtained, self.max_marks)
        self.grade = self.compute_grade(self.percentage)

    def to_dict(self, include_student=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "subject": self.subject,
            "exam_name": self.exam_name,
            "exam_type": self.exam_type,
            "marks_obtained": iso(self.marks_obtained),
            "max_marks": iso(self.max_marks),
            "percentage": iso(self.percentage),
            "grade": self.grade,
            "teacher_remark": self.teacher_remark,
            "exam_date": iso(self.exam_date),
            "recorded_by": self.recorded_by.full_name if self.recorded_by else "System",
            **self.timestamps,
        }
        if include_student and self.student:
            data["student"] = self.student.to_summary()
        return data


class ProgressCategory(TimestampMixin, db.Model):
    __tablename__ = "progress_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, unique=True)
    slug = db.Column(db.String(80), nullable=False, unique=True, index=True)
    description = db.Column(db.String(255), nullable=True)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    records = db.relationship(
        "ProgressRecord", back_populates="category", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "display_order": self.display_order,
            "is_active": self.is_active,
        }


class ProgressRecord(TimestampMixin, db.Model):
    """A 0-100 score for one student, one category, one month."""

    __tablename__ = "progress_records"
    __table_args__ = (
        db.UniqueConstraint(
            "student_id",
            "category_id",
            "period_year",
            "period_month",
            name="uq_progress_records_student_id_category",
        ),
        db.CheckConstraint("score >= 0 AND score <= 100", name="score_range"),
        db.CheckConstraint("period_month >= 1 AND period_month <= 12", name="month_range"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("progress_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score = db.Column(db.Numeric(5, 2), nullable=False)
    period_year = db.Column(db.Integer, nullable=False, index=True)
    period_month = db.Column(db.Integer, nullable=False)
    remarks = db.Column(db.Text, nullable=True)
    recorded_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    student = db.relationship("Student", back_populates="progress_records")
    category = db.relationship("ProgressCategory", back_populates="records")
    recorded_by = db.relationship("User")

    def to_dict(self, include_student=False):
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "category_id": self.category_id,
            "category": self.category.name if self.category else None,
            "category_slug": self.category.slug if self.category else None,
            "score": iso(self.score),
            "period_year": self.period_year,
            "period_month": self.period_month,
            "period_label": f"{self.period_year}-{self.period_month:02d}",
            "remarks": self.remarks,
            "recorded_by": self.recorded_by.full_name if self.recorded_by else "System",
            **self.timestamps,
        }
        if include_student and self.student:
            data["student"] = self.student.to_summary()
        return data
