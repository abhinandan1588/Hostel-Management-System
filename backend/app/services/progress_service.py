"""Academic results and category progress scoring."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..constants import (
    DEFAULT_PROGRESS_CATEGORIES,
    AttendanceStatus,
    AuditAction,
    NotificationPriority,
    NotificationType,
)
from ..extensions import db
from ..models import (
    AcademicProgress,
    AttendanceRecord,
    ProgressCategory,
    ProgressRecord,
    Student,
)
from ..utils.audit import record_audit
from ..utils.errors import NotFound, ValidationFailed
from ..utils.pagination import paginate_query
from . import notification_service


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
def ensure_default_categories():
    existing = {
        slug
        for slug in db.session.execute(select(ProgressCategory.slug)).scalars().all()
    }
    created = 0
    for order, (name, slug, description) in enumerate(DEFAULT_PROGRESS_CATEGORIES):
        if slug in existing:
            continue
        db.session.add(
            ProgressCategory(
                name=name, slug=slug, description=description, display_order=order
            )
        )
        created += 1
    if created:
        db.session.commit()
    return created


def list_categories():
    categories = (
        ProgressCategory.query.filter(ProgressCategory.is_active.is_(True))
        .order_by(ProgressCategory.display_order, ProgressCategory.name)
        .all()
    )
    return [category.to_dict() for category in categories]


def resolve_category(category_id=None, slug=None):
    category = None
    if category_id:
        category = db.session.get(ProgressCategory, int(category_id))
    elif slug:
        category = db.session.execute(
            select(ProgressCategory).where(ProgressCategory.slug == slug)
        ).scalars().first()
    if category is None:
        raise NotFound("Progress category not found")
    return category


# ---------------------------------------------------------------------------
# Academic records
# ---------------------------------------------------------------------------
def get_academic_record(record_id):
    record = db.session.get(AcademicProgress, int(record_id))
    if record is None:
        raise NotFound("Academic record not found")
    return record


def list_academic_records(filters, page=None, per_page=None, restrict_ids=None):
    query = AcademicProgress.query.options(joinedload(AcademicProgress.student))
    if restrict_ids is not None:
        if not restrict_ids:
            return [], 1, per_page or 20, 0
        query = query.filter(AcademicProgress.student_id.in_(restrict_ids))
    if filters.get("student_id"):
        query = query.filter(AcademicProgress.student_id == int(filters["student_id"]))
    if filters.get("subject"):
        query = query.filter(func.lower(AcademicProgress.subject) == filters["subject"].lower())
    if filters.get("start_date"):
        query = query.filter(AcademicProgress.exam_date >= filters["start_date"])
    if filters.get("end_date"):
        query = query.filter(AcademicProgress.exam_date <= filters["end_date"])

    query = query.order_by(AcademicProgress.exam_date.desc(), AcademicProgress.id.desc())
    return paginate_query(
        query, page, per_page, serializer=lambda r: r.to_dict(include_student=True)
    )


def create_academic_record(data, actor=None):
    student = db.session.get(Student, int(data["student_id"]))
    if student is None or not student.is_active:
        raise NotFound("Student not found")
    record = AcademicProgress(
        student_id=student.id,
        subject=data["subject"],
        exam_name=data["exam_name"],
        exam_type=data.get("exam_type"),
        marks_obtained=data["marks_obtained"],
        max_marks=data["max_marks"],
        teacher_remark=data.get("teacher_remark"),
        exam_date=data.get("exam_date") or date.today(),
        recorded_by_id=getattr(actor, "id", None),
    )
    record.recalculate()
    db.session.add(record)
    db.session.flush()

    record_audit(
        AuditAction.ACADEMIC_RECORD_CREATED,
        actor=actor,
        entity_type="academic_progress",
        entity_id=record.id,
        description=f"{student.full_name} {record.subject} {record.exam_name}: "
        f"{record.marks_obtained}/{record.max_marks} ({record.percentage}%)",
    )
    notification_service.notify_student_guardians(
        student,
        NotificationType.PROGRESS_UPDATE,
        "New academic result",
        f"{record.subject} - {record.exam_name}: {record.marks_obtained}/{record.max_marks} "
        f"({record.percentage}%, grade {record.grade}).",
        priority=NotificationPriority.NORMAL,
        link=f"/parent/children/{student.id}/progress",
        created_by=actor,
    )
    db.session.commit()
    return record


def update_academic_record(record, data, actor=None):
    for field in ("subject", "exam_name", "exam_type", "teacher_remark", "exam_date"):
        if field in data:
            setattr(record, field, data[field])
    if "marks_obtained" in data:
        record.marks_obtained = data["marks_obtained"]
    if "max_marks" in data:
        record.max_marks = data["max_marks"]
    if float(record.marks_obtained) > float(record.max_marks):
        raise ValidationFailed(
            "Marks obtained cannot exceed the maximum marks.",
            errors={"marks_obtained": ["Must be less than or equal to maximum marks."]},
        )
    record.recalculate()
    record_audit(
        AuditAction.ACADEMIC_RECORD_UPDATED,
        actor=actor,
        entity_type="academic_progress",
        entity_id=record.id,
        description=f"Updated {record.subject} result for {record.student.full_name}",
    )
    db.session.commit()
    return record


def delete_academic_record(record, actor=None):
    description = f"Deleted {record.subject} result for {record.student.full_name}"
    record_id = record.id
    db.session.delete(record)
    record_audit(
        AuditAction.ACADEMIC_RECORD_UPDATED,
        actor=actor,
        entity_type="academic_progress",
        entity_id=record_id,
        description=description,
    )
    db.session.commit()
    return True


def subject_averages(student_id):
    rows = db.session.execute(
        select(
            AcademicProgress.subject,
            func.avg(AcademicProgress.percentage),
            func.count(AcademicProgress.id),
        )
        .where(AcademicProgress.student_id == int(student_id))
        .group_by(AcademicProgress.subject)
        .order_by(AcademicProgress.subject)
    ).all()
    return [
        {
            "subject": row[0],
            "average_percentage": round(float(row[1] or 0), 2),
            "exam_count": row[2],
        }
        for row in rows
    ]


def academic_trend(student_id, limit=12):
    rows = (
        AcademicProgress.query.filter(AcademicProgress.student_id == int(student_id))
        .order_by(AcademicProgress.exam_date.asc(), AcademicProgress.id.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "label": f"{row.subject} · {row.exam_name}",
            "subject": row.subject,
            "exam_name": row.exam_name,
            "exam_date": row.exam_date.isoformat() if row.exam_date else None,
            "percentage": float(row.percentage or 0),
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Category progress
# ---------------------------------------------------------------------------
def upsert_progress(data, actor=None, commit=True, notify=True):
    student = db.session.get(Student, int(data["student_id"]))
    if student is None or not student.is_active:
        raise NotFound("Student not found")
    category = resolve_category(data.get("category_id"), data.get("category_slug"))
    today = date.today()
    year = data.get("period_year") or today.year
    month = data.get("period_month") or today.month

    record = db.session.execute(
        select(ProgressRecord).where(
            ProgressRecord.student_id == student.id,
            ProgressRecord.category_id == category.id,
            ProgressRecord.period_year == year,
            ProgressRecord.period_month == month,
        )
    ).scalars().first()
    if record is None:
        record = ProgressRecord(
            student_id=student.id,
            category_id=category.id,
            period_year=year,
            period_month=month,
        )
        db.session.add(record)
    record.score = data["score"]
    record.remarks = data.get("remarks")
    record.recorded_by_id = getattr(actor, "id", None)
    db.session.flush()

    record_audit(
        AuditAction.PROGRESS_UPDATED,
        actor=actor,
        entity_type="progress_record",
        entity_id=record.id,
        description=f"{student.full_name} {category.name} {year}-{month:02d}: {record.score}%",
    )
    if notify:
        notification_service.notify_student_guardians(
            student,
            NotificationType.PROGRESS_UPDATE,
            "Progress updated",
            f"{category.name} progress for {student.full_name} is now {float(record.score):.0f}%.",
            priority=NotificationPriority.LOW,
            link=f"/parent/children/{student.id}/progress",
            created_by=actor,
        )
    if commit:
        db.session.commit()
    return record


def bulk_upsert_progress(data, actor=None):
    today = date.today()
    year = data.get("period_year") or today.year
    month = data.get("period_month") or today.month
    saved = []
    for entry in data.get("scores") or []:
        payload = dict(entry)
        payload["student_id"] = data["student_id"]
        payload.setdefault("period_year", year)
        payload.setdefault("period_month", month)
        saved.append(upsert_progress(payload, actor=actor, commit=False, notify=False))
    if saved:
        student = db.session.get(Student, int(data["student_id"]))
        notification_service.notify_student_guardians(
            student,
            NotificationType.PROGRESS_UPDATE,
            "Progress updated",
            f"{len(saved)} progress categories were updated for {student.full_name}.",
            priority=NotificationPriority.LOW,
            link=f"/parent/children/{student.id}/progress",
            created_by=actor,
        )
    db.session.commit()
    return saved


def delete_progress_record(record_id, actor=None):
    record = db.session.get(ProgressRecord, int(record_id))
    if record is None:
        raise NotFound("Progress record not found")
    description = (
        f"Deleted {record.category.name if record.category else 'progress'} score for "
        f"{record.student.full_name}"
    )
    db.session.delete(record)
    record_audit(
        AuditAction.PROGRESS_UPDATED,
        actor=actor,
        entity_type="progress_record",
        entity_id=int(record_id),
        description=description,
    )
    db.session.commit()
    return True


def current_progress(student_id, year=None, month=None):
    """Latest score per category (falls back to the most recent month)."""
    today = date.today()
    year = year or today.year
    month = month or today.month
    categories = (
        ProgressCategory.query.filter(ProgressCategory.is_active.is_(True))
        .order_by(ProgressCategory.display_order, ProgressCategory.name)
        .all()
    )
    records = ProgressRecord.query.filter(
        ProgressRecord.student_id == int(student_id)
    ).order_by(
        ProgressRecord.period_year.desc(), ProgressRecord.period_month.desc()
    ).all()

    latest = {}
    for record in records:
        if record.category_id not in latest:
            latest[record.category_id] = record

    items = []
    for category in categories:
        record = latest.get(category.id)
        items.append(
            {
                "category_id": category.id,
                "category": category.name,
                "slug": category.slug,
                "description": category.description,
                "score": float(record.score) if record else None,
                "remarks": record.remarks if record else None,
                "period_label": f"{record.period_year}-{record.period_month:02d}"
                if record
                else None,
                "updated_at": record.updated_at.isoformat() + "Z" if record else None,
            }
        )
    scored = [item["score"] for item in items if item["score"] is not None]
    overall = round(sum(scored) / len(scored), 1) if scored else None
    return {"period": {"year": year, "month": month}, "items": items, "overall": overall}


def progress_history(student_id, months=6):
    """Monthly score series per category for comparison charts."""
    records = (
        ProgressRecord.query.options(joinedload(ProgressRecord.category))
        .filter(ProgressRecord.student_id == int(student_id))
        .order_by(ProgressRecord.period_year.asc(), ProgressRecord.period_month.asc())
        .all()
    )
    buckets = {}
    for record in records:
        key = f"{record.period_year}-{record.period_month:02d}"
        bucket = buckets.setdefault(key, {"period": key})
        if record.category:
            bucket[record.category.slug] = float(record.score)
    series = [buckets[key] for key in sorted(buckets)]
    return series[-months:]


def overview(student_id):
    """Everything the progress page needs in a single call."""
    student = db.session.get(Student, int(student_id))
    if student is None:
        raise NotFound("Student not found")
    from . import attendance_service

    attendance_rows = db.session.execute(
        select(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id)
        .group_by(AttendanceRecord.status)
    ).all()
    counts = {status.value: 0 for status in AttendanceStatus}
    for status, total in attendance_rows:
        counts[status.value] = total
    recorded = sum(counts.values())
    attendance_percentage = (
        round(((counts["PRESENT"] + counts["LATE"]) / recorded) * 100, 2) if recorded else 0.0
    )
    return {
        "student": student.to_summary(),
        "categories": current_progress(student.id),
        "subjects": subject_averages(student.id),
        "academic_trend": academic_trend(student.id),
        "progress_history": progress_history(student.id),
        "attendance": {
            "percentage": attendance_percentage,
            "monthly_trend": attendance_service.monthly_trend(student.id, months=6),
            **counts,
        },
    }
