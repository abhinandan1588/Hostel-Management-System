"""Daily activity timeline.

Administrators author the timeline. Students with their own login may only
*confirm* an activity - they can never create or edit one.
"""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..constants import (
    ACTIVITY_LABELS,
    DEFAULT_DAILY_ROUTINE,
    ActivityType,
    AuditAction,
)
from ..extensions import db
from ..models import DailyActivity, Student
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.dates import format_time_12h, parse_time
from ..utils.errors import NotFound, PermissionDenied
from ..utils.pagination import paginate_query


def get_activity(activity_id):
    activity = db.session.get(DailyActivity, int(activity_id))
    if activity is None:
        raise NotFound("Activity not found")
    return activity


def _serialize(activity):
    data = activity.to_dict()
    data["label"] = ACTIVITY_LABELS.get(activity.activity_type, activity.title)
    data["time_12h"] = format_time_12h(activity.activity_time or activity.scheduled_time)
    return data


def list_activities(filters, page=None, per_page=None, restrict_ids=None):
    query = DailyActivity.query.options(joinedload(DailyActivity.student))
    if restrict_ids is not None:
        if not restrict_ids:
            return [], 1, per_page or 20, 0
        query = query.filter(DailyActivity.student_id.in_(restrict_ids))
    if filters.get("student_id"):
        query = query.filter(DailyActivity.student_id == int(filters["student_id"]))
    if filters.get("date"):
        query = query.filter(DailyActivity.date == filters["date"])
    if filters.get("start_date"):
        query = query.filter(DailyActivity.date >= filters["start_date"])
    if filters.get("end_date"):
        query = query.filter(DailyActivity.date <= filters["end_date"])
    activity_type = ActivityType.coerce(filters.get("activity_type"))
    if activity_type:
        query = query.filter(DailyActivity.activity_type == activity_type)
    if filters.get("completed_only"):
        query = query.filter(DailyActivity.is_completed.is_(True))

    query = query.order_by(
        DailyActivity.date.desc(),
        DailyActivity.scheduled_time.asc().nulls_last(),
        DailyActivity.id.asc(),
    )
    return paginate_query(query, page, per_page, serializer=_serialize)


def timeline(student_id, on_date=None):
    """Ordered timeline for one student on one day."""
    on_date = on_date or date.today()
    activities = (
        DailyActivity.query.filter(
            DailyActivity.student_id == int(student_id), DailyActivity.date == on_date
        )
        .order_by(
            DailyActivity.scheduled_time.asc().nulls_last(),
            DailyActivity.activity_time.asc().nulls_last(),
            DailyActivity.id.asc(),
        )
        .all()
    )
    items = [_serialize(activity) for activity in activities]
    return {
        "date": on_date.isoformat(),
        "total": len(items),
        "completed": sum(1 for item in items if item["is_completed"]),
        "items": items,
    }


def create_activity(data, actor=None, commit=True):
    student = db.session.get(Student, int(data["student_id"]))
    if student is None or not student.is_active:
        raise NotFound("Student not found")
    activity_type = data["activity_type"]
    activity = DailyActivity(
        student_id=student.id,
        date=data.get("date") or date.today(),
        activity_type=activity_type,
        title=data.get("title") or ACTIVITY_LABELS.get(activity_type, activity_type.value.title()),
        scheduled_time=data.get("scheduled_time"),
        activity_time=data.get("activity_time"),
        is_completed=bool(data.get("is_completed")),
        remarks=data.get("remarks"),
        recorded_by_id=getattr(actor, "id", None),
    )
    if activity.is_completed and activity.activity_time is None:
        activity.activity_time = utcnow().time().replace(microsecond=0)
    db.session.add(activity)
    db.session.flush()
    record_audit(
        AuditAction.ACTIVITY_RECORDED,
        actor=actor,
        entity_type="daily_activity",
        entity_id=activity.id,
        description=f"{student.full_name} {activity.date}: {activity.title}",
    )
    if commit:
        db.session.commit()
    return activity


def update_activity(activity, data, actor=None):
    for field in ("activity_type", "title", "scheduled_time", "activity_time", "remarks"):
        if field in data:
            setattr(activity, field, data[field])
    if "is_completed" in data:
        activity.is_completed = bool(data["is_completed"])
        if activity.is_completed and activity.activity_time is None:
            activity.activity_time = utcnow().time().replace(microsecond=0)
    activity.recorded_by_id = getattr(actor, "id", None)
    record_audit(
        AuditAction.ACTIVITY_UPDATED,
        actor=actor,
        entity_type="daily_activity",
        entity_id=activity.id,
        description=f"Updated activity '{activity.title}' for {activity.student.full_name}",
    )
    db.session.commit()
    return activity


def complete_activity(activity, actor=None, activity_time=None):
    activity.is_completed = True
    activity.activity_time = activity_time or utcnow().time().replace(microsecond=0)
    activity.recorded_by_id = getattr(actor, "id", None)
    record_audit(
        AuditAction.ACTIVITY_UPDATED,
        actor=actor,
        entity_type="daily_activity",
        entity_id=activity.id,
        description=f"Marked '{activity.title}' complete for {activity.student.full_name}",
    )
    db.session.commit()
    return activity


def confirm_by_student(activity, student):
    """Student self-confirmation. Does not change any official field."""
    if activity.student_id != student.id:
        raise PermissionDenied("You may only confirm your own activities.")
    activity.confirmed_by_student = True
    activity.confirmed_at = utcnow()
    db.session.commit()
    return activity


def delete_activity(activity, actor=None):
    description = f"Deleted activity '{activity.title}' for {activity.student.full_name}"
    activity_id = activity.id
    db.session.delete(activity)
    record_audit(
        AuditAction.ACTIVITY_UPDATED,
        actor=actor,
        entity_type="daily_activity",
        entity_id=activity_id,
        description=description,
    )
    db.session.commit()
    return True


def generate_routine(data, actor=None):
    """Seed the default hostel routine for a day so wardens only tick items off."""
    on_date = data.get("date") or date.today()
    overwrite = bool(data.get("overwrite"))
    student_ids = data.get("student_ids")

    query = Student.query.filter(Student.is_active.is_(True))
    if student_ids:
        query = query.filter(Student.id.in_(student_ids))
    students = query.all()
    if not students:
        raise NotFound("No active students matched the request.")

    created = 0
    for student in students:
        existing = DailyActivity.query.filter(
            DailyActivity.student_id == student.id, DailyActivity.date == on_date
        )
        if overwrite:
            existing.delete(synchronize_session=False)
            present = set()
        else:
            present = {(row.activity_type, row.scheduled_time) for row in existing.all()}
        for activity_type, title, hhmm in DEFAULT_DAILY_ROUTINE:
            scheduled = parse_time(hhmm)
            if (activity_type, scheduled) in present:
                continue
            db.session.add(
                DailyActivity(
                    student_id=student.id,
                    date=on_date,
                    activity_type=activity_type,
                    title=title,
                    scheduled_time=scheduled,
                    is_completed=False,
                    recorded_by_id=getattr(actor, "id", None),
                )
            )
            created += 1

    record_audit(
        AuditAction.ACTIVITY_RECORDED,
        actor=actor,
        entity_type="daily_activity",
        entity_id=None,
        description=f"Generated {created} routine activities for {len(students)} student(s) "
        f"on {on_date}",
    )
    db.session.commit()
    return {"date": on_date.isoformat(), "students": len(students), "created": created}


def bulk_complete(student_ids, activity_type, on_date=None, actor=None):
    """Tick the same routine item for many students at once."""
    on_date = on_date or date.today()
    coerced = ActivityType.coerce(activity_type)
    if coerced is None:
        raise NotFound("Unknown activity type")
    now = utcnow().time().replace(microsecond=0)
    updated = DailyActivity.query.filter(
        DailyActivity.student_id.in_(student_ids),
        DailyActivity.date == on_date,
        DailyActivity.activity_type == coerced,
    ).update(
        {"is_completed": True, "activity_time": now, "recorded_by_id": getattr(actor, "id", None)},
        synchronize_session=False,
    )
    record_audit(
        AuditAction.ACTIVITY_UPDATED,
        actor=actor,
        entity_type="daily_activity",
        description=f"Bulk completed {coerced.value} for {updated} student(s) on {on_date}",
    )
    db.session.commit()
    return updated


def completion_stats(on_date=None):
    on_date = on_date or date.today()
    total = db.session.execute(
        select(func.count(DailyActivity.id)).where(DailyActivity.date == on_date)
    ).scalar() or 0
    completed = db.session.execute(
        select(func.count(DailyActivity.id)).where(
            DailyActivity.date == on_date, DailyActivity.is_completed.is_(True)
        )
    ).scalar() or 0
    return {
        "date": on_date.isoformat(),
        "total": total,
        "completed": completed,
        "pending": max(total - completed, 0),
        "completion_rate": round((completed / total) * 100, 1) if total else 0.0,
    }


def recent_hostel_activity(limit=15):
    """Latest completed activities across the hostel for the admin dashboard."""
    rows = (
        DailyActivity.query.options(joinedload(DailyActivity.student))
        .filter(DailyActivity.is_completed.is_(True))
        .order_by(DailyActivity.date.desc(), DailyActivity.activity_time.desc().nulls_last())
        .limit(limit)
        .all()
    )
    return [
        {
            **_serialize(row),
            "student": row.student.to_summary() if row.student else None,
        }
        for row in rows
    ]
