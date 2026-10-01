"""School attendance tracking (left for school / returned to hostel)."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..constants import (
    AuditAction,
    NotificationPriority,
    NotificationType,
    SchoolAttendanceStatus,
    StudentStatus,
)
from ..extensions import db
from ..models import SchoolAttendance, Student, StudentStatusHistory
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.dates import format_time_12h
from ..utils.errors import NotFound
from ..utils.pagination import paginate_query
from . import notification_service

STATUS_LABELS = {
    SchoolAttendanceStatus.WENT_TO_SCHOOL: "Went to School",
    SchoolAttendanceStatus.DID_NOT_GO: "Did Not Go",
    SchoolAttendanceStatus.ON_LEAVE: "On Leave",
    SchoolAttendanceStatus.SCHOOL_HOLIDAY: "School Holiday",
    SchoolAttendanceStatus.RETURNED_FROM_SCHOOL: "Returned From School",
}

# Keep the student's hostel activity status in sync with school movement.
STATUS_TO_ACTIVITY = {
    SchoolAttendanceStatus.WENT_TO_SCHOOL: StudentStatus.AT_SCHOOL,
    SchoolAttendanceStatus.RETURNED_FROM_SCHOOL: StudentStatus.RETURNED_TO_HOSTEL,
    SchoolAttendanceStatus.ON_LEAVE: StudentStatus.ON_LEAVE,
    SchoolAttendanceStatus.DID_NOT_GO: StudentStatus.IN_HOSTEL,
    SchoolAttendanceStatus.SCHOOL_HOLIDAY: StudentStatus.IN_HOSTEL,
}


def get_record(record_id):
    record = db.session.get(SchoolAttendance, int(record_id))
    if record is None:
        raise NotFound("School attendance record not found")
    return record


def list_records(filters, page=None, per_page=None, restrict_ids=None):
    query = SchoolAttendance.query.options(joinedload(SchoolAttendance.student))
    if restrict_ids is not None:
        if not restrict_ids:
            return [], 1, per_page or 20, 0
        query = query.filter(SchoolAttendance.student_id.in_(restrict_ids))
    if filters.get("student_id"):
        query = query.filter(SchoolAttendance.student_id == int(filters["student_id"]))
    if filters.get("date"):
        query = query.filter(SchoolAttendance.date == filters["date"])
    if filters.get("start_date"):
        query = query.filter(SchoolAttendance.date >= filters["start_date"])
    if filters.get("end_date"):
        query = query.filter(SchoolAttendance.date <= filters["end_date"])
    status = SchoolAttendanceStatus.coerce(filters.get("status"))
    if status:
        query = query.filter(SchoolAttendance.status == status)
    if filters.get("student_class"):
        matching = select(Student.id).where(Student.student_class == filters["student_class"])
        query = query.filter(SchoolAttendance.student_id.in_(matching))

    query = query.order_by(SchoolAttendance.date.desc(), SchoolAttendance.id.desc())
    return paginate_query(
        query, page, per_page, serializer=lambda r: r.to_dict(include_student=True)
    )


def record_school_attendance(data, actor=None, notify=True, commit=True):
    student = db.session.get(Student, int(data["student_id"]))
    if student is None or not student.is_active:
        raise NotFound("Student not found")

    on_date = data.get("date") or date.today()
    status = data["status"]

    record = db.session.execute(
        select(SchoolAttendance).where(
            SchoolAttendance.student_id == student.id, SchoolAttendance.date == on_date
        )
    ).scalars().first()
    is_update = record is not None
    previous = record.status if record else None

    if record is None:
        record = SchoolAttendance(student_id=student.id, date=on_date, status=status)
        db.session.add(record)
    else:
        record.status = status

    for field in ("departure_time", "expected_return_time", "actual_return_time", "remarks"):
        if field in data:
            setattr(record, field, data[field])
    record.recorded_by_id = getattr(actor, "id", None)
    db.session.flush()

    # Mirror the movement onto the student's activity status + history.
    activity_status = STATUS_TO_ACTIVITY.get(status)
    if activity_status and student.current_status != activity_status:
        student.current_status = activity_status
        student.status_updated_at = utcnow()
        db.session.add(
            StudentStatusHistory(
                student_id=student.id,
                status=activity_status,
                updated_by_id=getattr(actor, "id", None),
                remarks=f"School status: {STATUS_LABELS.get(status, status.value)}",
            )
        )

    record_audit(
        AuditAction.SCHOOL_ATTENDANCE_RECORDED,
        actor=actor,
        entity_type="school_attendance",
        entity_id=record.id,
        description=f"{student.full_name} {on_date}: "
        + (f"{previous.value} -> " if previous else "")
        + status.value,
    )

    if notify and previous != status:
        label = STATUS_LABELS.get(status, status.value)
        detail = ""
        if status == SchoolAttendanceStatus.WENT_TO_SCHOOL and record.departure_time:
            detail = f" Departure: {format_time_12h(record.departure_time)}."
        if status == SchoolAttendanceStatus.RETURNED_FROM_SCHOOL and record.actual_return_time:
            detail = f" Returned: {format_time_12h(record.actual_return_time)}."
        notification_service.notify_student_guardians(
            student,
            NotificationType.SCHOOL_STATUS,
            f"School status: {label}",
            f"{student.full_name} - {label} on {on_date:%d %b %Y}.{detail}",
            priority=NotificationPriority.NORMAL,
            link=f"/parent/children/{student.id}/school",
            created_by=actor,
            include_student_account=False,
        )

    if commit:
        db.session.commit()
    return record


def update_record(record, data, actor=None):
    if "status" in data and data["status"]:
        record.status = data["status"]
    for field in ("departure_time", "expected_return_time", "actual_return_time", "remarks"):
        if field in data:
            setattr(record, field, data[field])
    record.recorded_by_id = getattr(actor, "id", None)
    record_audit(
        AuditAction.SCHOOL_ATTENDANCE_RECORDED,
        actor=actor,
        entity_type="school_attendance",
        entity_id=record.id,
        description=f"Updated school attendance for {record.student.full_name} on {record.date}",
    )
    db.session.commit()
    return record


def mark_returned(record, return_time=None, actor=None):
    record.status = SchoolAttendanceStatus.RETURNED_FROM_SCHOOL
    record.actual_return_time = return_time or utcnow().time().replace(microsecond=0)
    record.recorded_by_id = getattr(actor, "id", None)
    student = record.student
    student.current_status = StudentStatus.RETURNED_TO_HOSTEL
    student.status_updated_at = utcnow()
    db.session.add(
        StudentStatusHistory(
            student_id=student.id,
            status=StudentStatus.RETURNED_TO_HOSTEL,
            updated_by_id=getattr(actor, "id", None),
            remarks="Returned from school",
        )
    )
    record_audit(
        AuditAction.SCHOOL_ATTENDANCE_RECORDED,
        actor=actor,
        entity_type="school_attendance",
        entity_id=record.id,
        description=f"{student.full_name} returned from school at {record.actual_return_time}",
    )
    notification_service.notify_student_guardians(
        student,
        NotificationType.SCHOOL_STATUS,
        "Returned from school",
        f"{student.full_name} returned to the hostel at "
        f"{format_time_12h(record.actual_return_time)}.",
        priority=NotificationPriority.NORMAL,
        link=f"/parent/children/{student.id}/school",
        created_by=actor,
        include_student_account=False,
    )
    db.session.commit()
    return record


def delete_record(record, actor=None):
    description = f"Deleted school attendance for {record.student.full_name} on {record.date}"
    record_id = record.id
    db.session.delete(record)
    record_audit(
        AuditAction.SCHOOL_ATTENDANCE_RECORDED,
        actor=actor,
        entity_type="school_attendance",
        entity_id=record_id,
        description=description,
    )
    db.session.commit()
    return True


def daily_sheet(on_date=None, student_class=None):
    on_date = on_date or date.today()
    query = Student.query.filter(Student.is_active.is_(True))
    if student_class:
        query = query.filter(Student.student_class == student_class)
    students = query.order_by(Student.full_name).all()
    existing = {
        row.student_id: row
        for row in SchoolAttendance.query.filter(SchoolAttendance.date == on_date).all()
    }
    rows = []
    for student in students:
        record = existing.get(student.id)
        rows.append(
            {
                **student.to_summary(),
                "record_id": record.id if record else None,
                "status": record.status.value if record else None,
                "departure_time": record.departure_time.isoformat() if record and record.departure_time else None,
                "expected_return_time": record.expected_return_time.isoformat()
                if record and record.expected_return_time
                else None,
                "actual_return_time": record.actual_return_time.isoformat()
                if record and record.actual_return_time
                else None,
                "remarks": record.remarks if record else None,
            }
        )
    counts = {status.value: 0 for status in SchoolAttendanceStatus}
    counts["NOT_MARKED"] = 0
    for row in rows:
        if row["status"]:
            counts[row["status"]] += 1
        else:
            counts["NOT_MARKED"] += 1
    return {
        "date": on_date.isoformat(),
        "total_students": len(rows),
        "counts": counts,
        "rows": rows,
    }


def status_for_date(student_id, on_date=None):
    on_date = on_date or date.today()
    record = db.session.execute(
        select(SchoolAttendance).where(
            SchoolAttendance.student_id == int(student_id), SchoolAttendance.date == on_date
        )
    ).scalars().first()
    if record is None:
        return None
    data = record.to_dict()
    data["label"] = STATUS_LABELS.get(record.status, record.status.value)
    data["departure_time_12h"] = format_time_12h(record.departure_time)
    data["actual_return_time_12h"] = format_time_12h(record.actual_return_time)
    return data


def weekly_counts(start_date, end_date, student_ids=None):
    query = (
        select(SchoolAttendance.date, SchoolAttendance.status, func.count(SchoolAttendance.id))
        .where(SchoolAttendance.date >= start_date, SchoolAttendance.date <= end_date)
        .group_by(SchoolAttendance.date, SchoolAttendance.status)
        .order_by(SchoolAttendance.date)
    )
    if student_ids is not None:
        if not student_ids:
            return []
        query = query.where(SchoolAttendance.student_id.in_(student_ids))
    rows = db.session.execute(query).all()
    buckets = {}
    for on_date, status, total in rows:
        bucket = buckets.setdefault(
            on_date.isoformat(),
            {
                "date": on_date.isoformat(),
                **{status_member.value: 0 for status_member in SchoolAttendanceStatus},
            },
        )
        bucket[status.value] = total
    return [buckets[key] for key in sorted(buckets)]


def today_counts():
    today = date.today()
    rows = db.session.execute(
        select(SchoolAttendance.status, func.count(SchoolAttendance.id))
        .where(SchoolAttendance.date == today)
        .group_by(SchoolAttendance.status)
    ).all()
    counts = {status.value: 0 for status in SchoolAttendanceStatus}
    for status, total in rows:
        counts[status.value] = total
    return counts
