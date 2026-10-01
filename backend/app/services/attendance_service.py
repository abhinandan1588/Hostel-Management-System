"""Hostel attendance: recording, analytics and calendars.

Attendance is an *official record*: only administrators may write here.
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..constants import (
    AttendanceSession,
    AttendanceStatus,
    AuditAction,
    NotificationPriority,
    NotificationType,
)
from ..extensions import db
from ..models import AttendanceRecord, Student
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.dates import month_bounds
from ..utils.errors import NotFound
from ..utils.pagination import paginate_query
from . import notification_service

# Statuses that should alert a parent immediately.
ALERT_STATUSES = {AttendanceStatus.ABSENT, AttendanceStatus.LATE}


def get_record(record_id):
    record = db.session.get(AttendanceRecord, int(record_id))
    if record is None:
        raise NotFound("Attendance record not found")
    return record


def list_records(filters, page=None, per_page=None, restrict_ids=None):
    query = AttendanceRecord.query.options(joinedload(AttendanceRecord.student))
    if restrict_ids is not None:
        if not restrict_ids:
            return [], 1, per_page or 20, 0
        query = query.filter(AttendanceRecord.student_id.in_(restrict_ids))
    if filters.get("student_id"):
        query = query.filter(AttendanceRecord.student_id == int(filters["student_id"]))
    if filters.get("date"):
        query = query.filter(AttendanceRecord.date == filters["date"])
    if filters.get("start_date"):
        query = query.filter(AttendanceRecord.date >= filters["start_date"])
    if filters.get("end_date"):
        query = query.filter(AttendanceRecord.date <= filters["end_date"])
    status = AttendanceStatus.coerce(filters.get("status"))
    if status:
        query = query.filter(AttendanceRecord.status == status)
    session = AttendanceSession.coerce(filters.get("session"))
    if session:
        query = query.filter(AttendanceRecord.session == session)
    if filters.get("student_class"):
        matching = select(Student.id).where(Student.student_class == filters["student_class"])
        query = query.filter(AttendanceRecord.student_id.in_(matching))

    query = query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.id.desc())
    return paginate_query(
        query, page, per_page, serializer=lambda record: record.to_dict(include_student=True)
    )


def record_attendance(data, actor=None, notify=True, commit=True):
    """Create or update the attendance entry for one student/day/session."""
    student = db.session.get(Student, int(data["student_id"]))
    if student is None or not student.is_active:
        raise NotFound("Student not found")

    on_date = data.get("date") or date.today()
    session = data.get("session") or AttendanceSession.MORNING
    status = data["status"]

    record = db.session.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.date == on_date,
            AttendanceRecord.session == session,
        )
    ).scalars().first()

    is_update = record is not None
    previous_status = record.status if record else None

    if record is None:
        record = AttendanceRecord(
            student_id=student.id, date=on_date, session=session, status=status
        )
        db.session.add(record)
    else:
        record.status = status
    record.remarks = data.get("remarks")
    record.marked_at = utcnow()
    record.marked_by_id = getattr(actor, "id", None)

    record_audit(
        AuditAction.ATTENDANCE_MODIFIED if is_update else AuditAction.ATTENDANCE_RECORDED,
        actor=actor,
        entity_type="attendance",
        entity_id=record.id,
        description=(
            f"{student.full_name} ({student.student_code}) {on_date} {session.value}: "
            + (f"{previous_status.value} -> " if previous_status else "")
            + status.value
        ),
    )

    if notify and status in ALERT_STATUSES and previous_status != status:
        label = status.value.title()
        notification_service.notify_student_guardians(
            student,
            NotificationType.ATTENDANCE_ALERT,
            f"Attendance update: {label}",
            f"{student.full_name} was marked {label} for the "
            f"{session.value.lower()} roll call on {on_date:%d %b %Y}."
            + (f" Remarks: {record.remarks}" if record.remarks else ""),
            priority=NotificationPriority.HIGH
            if status == AttendanceStatus.ABSENT
            else NotificationPriority.NORMAL,
            link=f"/parent/children/{student.id}/attendance",
            created_by=actor,
            include_student_account=False,
        )

    if commit:
        db.session.commit()
    return record


def bulk_record(data, actor=None):
    on_date = data.get("date") or date.today()
    session = data.get("session") or AttendanceSession.MORNING
    results = []
    for entry in data["records"]:
        payload = {
            "student_id": entry["student_id"],
            "status": entry["status"],
            "remarks": entry.get("remarks"),
            "date": on_date,
            "session": session,
        }
        results.append(record_attendance(payload, actor=actor, commit=False))
    db.session.commit()
    return results


def update_record(record, data, actor=None):
    previous = record.status
    if "status" in data and data["status"]:
        record.status = data["status"]
    if "session" in data and data["session"]:
        record.session = data["session"]
    if "remarks" in data:
        record.remarks = data["remarks"]
    record.marked_at = utcnow()
    record.marked_by_id = getattr(actor, "id", None)
    record_audit(
        AuditAction.ATTENDANCE_MODIFIED,
        actor=actor,
        entity_type="attendance",
        entity_id=record.id,
        description=f"{record.student.full_name} {record.date}: "
        f"{previous.value} -> {record.status.value}",
    )
    db.session.commit()
    return record


def delete_record(record, actor=None):
    description = f"Deleted attendance for {record.student.full_name} on {record.date}"
    db.session.delete(record)
    record_audit(
        AuditAction.ATTENDANCE_MODIFIED,
        actor=actor,
        entity_type="attendance",
        entity_id=record.id,
        description=description,
    )
    db.session.commit()
    return True


# ---------------------------------------------------------------------------
# Daily sheet for the admin "mark attendance" screen
# ---------------------------------------------------------------------------
def daily_sheet(on_date=None, session=None, student_class=None):
    on_date = on_date or date.today()
    session = session or AttendanceSession.MORNING
    query = Student.query.filter(Student.is_active.is_(True))
    if student_class:
        query = query.filter(Student.student_class == student_class)
    students = query.order_by(Student.full_name).all()

    existing = {
        row.student_id: row
        for row in AttendanceRecord.query.filter(
            AttendanceRecord.date == on_date, AttendanceRecord.session == session
        ).all()
    }
    rows = []
    for student in students:
        record = existing.get(student.id)
        rows.append(
            {
                **student.to_summary(),
                "record_id": record.id if record else None,
                "status": record.status.value if record else None,
                "remarks": record.remarks if record else None,
                "marked_at": record.marked_at.isoformat() + "Z" if record else None,
                "marked_by": (record.marked_by.full_name if record and record.marked_by else None),
            }
        )
    counts = summarize_statuses([r["status"] for r in rows])
    return {
        "date": on_date.isoformat(),
        "session": session.value,
        "total_students": len(rows),
        "marked": sum(1 for row in rows if row["status"]),
        "pending": sum(1 for row in rows if not row["status"]),
        "counts": counts,
        "rows": rows,
    }


def summarize_statuses(statuses):
    counts = {status.value: 0 for status in AttendanceStatus}
    counts["NOT_MARKED"] = 0
    for value in statuses:
        if value in counts:
            counts[value] += 1
        elif value is None:
            counts["NOT_MARKED"] += 1
    return counts


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
def student_summary(student_id, start_date, end_date):
    rows = db.session.execute(
        select(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .where(
            AttendanceRecord.student_id == int(student_id),
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date,
            AttendanceRecord.session == AttendanceSession.MORNING,
        )
        .group_by(AttendanceRecord.status)
    ).all()
    counts = {status.value: 0 for status in AttendanceStatus}
    for status, total in rows:
        counts[status.value] = total
    recorded = sum(counts.values())
    # LATE still counts as physically present.
    present_equivalent = counts["PRESENT"] + counts["LATE"]
    percentage = round((present_equivalent / recorded) * 100, 2) if recorded else 0.0
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "present": counts["PRESENT"],
        "absent": counts["ABSENT"],
        "leave": counts["LEAVE"],
        "late": counts["LATE"],
        "recorded_days": recorded,
        "attendance_percentage": percentage,
    }


def monthly_summary(student_id, year, month):
    start, end = month_bounds(year, month)
    summary = student_summary(student_id, start, end)
    summary.update({"year": year, "month": month})
    return summary


def calendar(student_id, year, month):
    start, end = month_bounds(year, month)
    rows = AttendanceRecord.query.filter(
        AttendanceRecord.student_id == int(student_id),
        AttendanceRecord.date >= start,
        AttendanceRecord.date <= end,
        AttendanceRecord.session == AttendanceSession.MORNING,
    ).all()
    by_date = {row.date.isoformat(): row.status.value for row in rows}
    days = []
    cursor = start
    while cursor <= end:
        days.append(
            {
                "date": cursor.isoformat(),
                "day": cursor.day,
                "weekday": cursor.weekday(),
                "status": by_date.get(cursor.isoformat()),
            }
        )
        cursor += timedelta(days=1)
    return {
        "year": year,
        "month": month,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "days": days,
        "summary": monthly_summary(student_id, year, month),
    }


def daily_trend(start_date, end_date, student_ids=None):
    """Per-day counts used by the admin attendance chart."""
    query = (
        select(AttendanceRecord.date, AttendanceRecord.status, func.count(AttendanceRecord.id))
        .where(
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= end_date,
            AttendanceRecord.session == AttendanceSession.MORNING,
        )
        .group_by(AttendanceRecord.date, AttendanceRecord.status)
        .order_by(AttendanceRecord.date)
    )
    if student_ids is not None:
        if not student_ids:
            return []
        query = query.where(AttendanceRecord.student_id.in_(student_ids))
    rows = db.session.execute(query).all()
    buckets = {}
    for on_date, status, total in rows:
        bucket = buckets.setdefault(
            on_date.isoformat(),
            {"date": on_date.isoformat(), "PRESENT": 0, "ABSENT": 0, "LEAVE": 0, "LATE": 0},
        )
        bucket[status.value] = total
    return [buckets[key] for key in sorted(buckets)]


def monthly_trend(student_id, months=6):
    """Attendance percentage per month for the last ``months`` months."""
    today = date.today()
    series = []
    year, month = today.year, today.month
    for _ in range(months):
        summary = monthly_summary(student_id, year, month)
        series.append(
            {
                "label": date(year, month, 1).strftime("%b %Y"),
                "year": year,
                "month": month,
                "percentage": summary["attendance_percentage"],
                "present": summary["present"],
                "absent": summary["absent"],
                "leave": summary["leave"],
                "late": summary["late"],
            }
        )
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(series))


def today_counts():
    today = date.today()
    rows = db.session.execute(
        select(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .where(AttendanceRecord.date == today, AttendanceRecord.session == AttendanceSession.MORNING)
        .group_by(AttendanceRecord.status)
    ).all()
    counts = {status.value: 0 for status in AttendanceStatus}
    for status, total in rows:
        counts[status.value] = total
    total_students = db.session.execute(
        select(func.count(Student.id)).where(Student.is_active.is_(True))
    ).scalar() or 0
    counts["NOT_MARKED"] = max(total_students - sum(counts.values()), 0)
    counts["TOTAL_STUDENTS"] = total_students
    return counts
