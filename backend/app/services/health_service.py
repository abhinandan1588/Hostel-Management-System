"""Health / sick tracking.

Medical information is sensitive: reads are always scoped through
``authorize_student_access`` in the route layer, writes are admin-only.
"""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..constants import (
    AuditAction,
    HealthSeverity,
    HealthStatus,
    NotificationPriority,
    NotificationType,
    RecoveryStatus,
)
from ..extensions import db
from ..models import HealthRecord, Student
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.errors import NotFound
from ..utils.pagination import paginate_query
from . import notification_service

STATUS_LABELS = {
    HealthStatus.HEALTHY: "Healthy",
    HealthStatus.FEELING_UNWELL: "Feeling Unwell",
    HealthStatus.SICK: "Sick",
    HealthStatus.MEDICAL_OBSERVATION: "Under Medical Observation",
    HealthStatus.HOSPITALIZED: "Hospitalized",
}

# Anything other than "healthy" is worth telling a parent about.
NOTIFY_STATUSES = {
    HealthStatus.FEELING_UNWELL,
    HealthStatus.SICK,
    HealthStatus.MEDICAL_OBSERVATION,
    HealthStatus.HOSPITALIZED,
}


def get_record(record_id):
    record = db.session.get(HealthRecord, int(record_id))
    if record is None:
        raise NotFound("Health record not found")
    return record


def list_records(filters, page=None, per_page=None, restrict_ids=None):
    query = HealthRecord.query.options(joinedload(HealthRecord.student))
    if restrict_ids is not None:
        if not restrict_ids:
            return [], 1, per_page or 20, 0
        query = query.filter(HealthRecord.student_id.in_(restrict_ids))
    if filters.get("student_id"):
        query = query.filter(HealthRecord.student_id == int(filters["student_id"]))
    status = HealthStatus.coerce(filters.get("status"))
    if status:
        query = query.filter(HealthRecord.status == status)
    severity = HealthSeverity.coerce(filters.get("severity"))
    if severity:
        query = query.filter(HealthRecord.severity == severity)
    recovery = RecoveryStatus.coerce(filters.get("recovery_status"))
    if recovery:
        query = query.filter(HealthRecord.recovery_status == recovery)
    if filters.get("start_date"):
        query = query.filter(func.date(HealthRecord.recorded_at) >= filters["start_date"])
    if filters.get("end_date"):
        query = query.filter(func.date(HealthRecord.recorded_at) <= filters["end_date"])
    if filters.get("urgent_only"):
        query = query.filter(
            HealthRecord.status.in_([HealthStatus.HOSPITALIZED, HealthStatus.MEDICAL_OBSERVATION])
            | HealthRecord.severity.in_([HealthSeverity.HIGH, HealthSeverity.CRITICAL])
        )

    query = query.order_by(HealthRecord.recorded_at.desc(), HealthRecord.id.desc())
    return paginate_query(
        query, page, per_page, serializer=lambda record: record.to_dict(include_student=True)
    )


def _infer_severity(data):
    explicit = data.get("severity")
    if explicit:
        return explicit
    status = data.get("status")
    if status == HealthStatus.HOSPITALIZED:
        return HealthSeverity.CRITICAL
    if status == HealthStatus.MEDICAL_OBSERVATION:
        return HealthSeverity.HIGH
    if status == HealthStatus.SICK:
        return HealthSeverity.MEDIUM
    return HealthSeverity.LOW


def create_record(data, actor=None):
    student = db.session.get(Student, int(data["student_id"]))
    if student is None or not student.is_active:
        raise NotFound("Student not found")

    status = data["status"]
    severity = _infer_severity(data)
    record = HealthRecord(
        student_id=student.id,
        status=status,
        severity=severity,
        symptoms=data.get("symptoms"),
        temperature=data.get("temperature"),
        description=data.get("description"),
        medicine_given=data.get("medicine_given"),
        doctor_visited=bool(data.get("doctor_visited")),
        doctor_name=data.get("doctor_name"),
        hospital_visit=bool(data.get("hospital_visit")),
        hospital_name=data.get("hospital_name"),
        medical_remarks=data.get("medical_remarks"),
        recovery_status=data.get("recovery_status")
        or (RecoveryStatus.RECOVERED if status == HealthStatus.HEALTHY else RecoveryStatus.ONGOING),
        recorded_at=data.get("recorded_at") or utcnow(),
        recorded_by_id=getattr(actor, "id", None),
    )
    if record.recovery_status == RecoveryStatus.RECOVERED:
        record.recovered_at = record.recorded_at
    db.session.add(record)
    db.session.flush()

    record_audit(
        AuditAction.HEALTH_RECORD_CREATED,
        actor=actor,
        entity_type="health_record",
        entity_id=record.id,
        description=f"{student.full_name} ({student.student_code}) health status: "
        f"{status.value} / {severity.value}",
    )

    if status in NOTIFY_STATUSES:
        label = STATUS_LABELS.get(status, status.value)
        urgent = record.is_urgent
        message = f"{student.full_name} has been marked as {label.lower()}."
        if record.symptoms:
            message += f" Symptoms: {record.symptoms}."
        if record.temperature:
            message += f" Temperature: {record.temperature} °C."
        message += " Please check the health section for details."
        notification_service.notify_student_guardians(
            student,
            NotificationType.HEALTH_ALERT,
            f"Health update: {label}",
            message,
            priority=NotificationPriority.URGENT if urgent else NotificationPriority.HIGH,
            link=f"/parent/children/{student.id}/health",
            created_by=actor,
            include_student_account=False,
            send_email=urgent,
        )

    db.session.commit()
    return record


def update_record(record, data, actor=None):
    simple_fields = (
        "status",
        "severity",
        "symptoms",
        "temperature",
        "description",
        "medicine_given",
        "doctor_name",
        "hospital_name",
        "medical_remarks",
        "recovery_status",
    )
    for field in simple_fields:
        if field in data:
            setattr(record, field, data[field])
    if "doctor_visited" in data:
        record.doctor_visited = bool(data["doctor_visited"])
    if "hospital_visit" in data:
        record.hospital_visit = bool(data["hospital_visit"])
    if record.recovery_status == RecoveryStatus.RECOVERED and record.recovered_at is None:
        record.recovered_at = utcnow()
    if record.recovery_status != RecoveryStatus.RECOVERED:
        record.recovered_at = None

    record_audit(
        AuditAction.HEALTH_RECORD_UPDATED,
        actor=actor,
        entity_type="health_record",
        entity_id=record.id,
        description=f"Updated health record for {record.student.full_name}",
    )
    db.session.commit()
    return record


def mark_recovered(record, actor=None, remarks=None):
    record.recovery_status = RecoveryStatus.RECOVERED
    record.recovered_at = utcnow()
    record.status = HealthStatus.HEALTHY
    if remarks:
        record.medical_remarks = remarks
    record_audit(
        AuditAction.HEALTH_RECORD_UPDATED,
        actor=actor,
        entity_type="health_record",
        entity_id=record.id,
        description=f"{record.student.full_name} marked recovered",
    )
    notification_service.notify_student_guardians(
        record.student,
        NotificationType.HEALTH_ALERT,
        "Health update: Recovered",
        f"{record.student.full_name} has recovered and is back to normal routine.",
        priority=NotificationPriority.NORMAL,
        link=f"/parent/children/{record.student_id}/health",
        created_by=actor,
        include_student_account=False,
    )
    db.session.commit()
    return record


def delete_record(record, actor=None):
    description = f"Deleted health record for {record.student.full_name} ({record.recorded_at})"
    db.session.delete(record)
    record_audit(
        AuditAction.HEALTH_RECORD_UPDATED,
        actor=actor,
        entity_type="health_record",
        entity_id=record.id,
        description=description,
    )
    db.session.commit()
    return True


def current_status(student_id):
    record = (
        HealthRecord.query.filter(HealthRecord.student_id == int(student_id))
        .order_by(HealthRecord.recorded_at.desc(), HealthRecord.id.desc())
        .first()
    )
    if record is None:
        return {
            "status": HealthStatus.HEALTHY.value,
            "label": STATUS_LABELS[HealthStatus.HEALTHY],
            "severity": HealthSeverity.LOW.value,
            "recorded_at": None,
            "record": None,
            "is_urgent": False,
        }
    return {
        "status": record.status.value,
        "label": STATUS_LABELS.get(record.status, record.status.value),
        "severity": record.severity.value,
        "recorded_at": record.recorded_at.isoformat() + "Z",
        "record": record.to_dict(),
        "is_urgent": record.is_urgent,
    }


def hostel_overview():
    """Counts per health status across all active students."""
    newest = (
        select(
            HealthRecord.student_id.label("sid"),
            func.max(HealthRecord.recorded_at).label("ts"),
        )
        .group_by(HealthRecord.student_id)
        .subquery()
    )
    rows = db.session.execute(
        select(HealthRecord.status, func.count(HealthRecord.id))
        .join(
            newest,
            (HealthRecord.student_id == newest.c.sid) & (HealthRecord.recorded_at == newest.c.ts),
        )
        .join(Student, Student.id == HealthRecord.student_id)
        .where(Student.is_active.is_(True))
        .group_by(HealthRecord.status)
    ).all()
    counts = {status.value: 0 for status in HealthStatus}
    for status, total in rows:
        counts[status.value] = total
    total_students = db.session.execute(
        select(func.count(Student.id)).where(Student.is_active.is_(True))
    ).scalar() or 0
    tracked = sum(counts.values())
    # Students with no health record at all are healthy by default.
    counts[HealthStatus.HEALTHY.value] += max(total_students - tracked, 0)
    counts["TOTAL_STUDENTS"] = total_students
    counts["NEEDS_ATTENTION"] = (
        counts[HealthStatus.FEELING_UNWELL.value]
        + counts[HealthStatus.SICK.value]
        + counts[HealthStatus.MEDICAL_OBSERVATION.value]
        + counts[HealthStatus.HOSPITALIZED.value]
    )
    return counts


def active_cases(limit=20):
    newest = (
        select(
            HealthRecord.student_id.label("sid"),
            func.max(HealthRecord.recorded_at).label("ts"),
        )
        .group_by(HealthRecord.student_id)
        .subquery()
    )
    records = (
        HealthRecord.query.options(joinedload(HealthRecord.student))
        .join(
            newest,
            (HealthRecord.student_id == newest.c.sid) & (HealthRecord.recorded_at == newest.c.ts),
        )
        .join(Student, Student.id == HealthRecord.student_id)
        .filter(
            Student.is_active.is_(True),
            HealthRecord.status != HealthStatus.HEALTHY,
        )
        .order_by(HealthRecord.severity.desc(), HealthRecord.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [record.to_dict(include_student=True) for record in records]


def timeline(student_id, limit=50):
    records = (
        HealthRecord.query.filter(HealthRecord.student_id == int(student_id))
        .order_by(HealthRecord.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [record.to_dict() for record in records]


def records_for_date(student_id, on_date=None):
    on_date = on_date or date.today()
    records = (
        HealthRecord.query.filter(
            HealthRecord.student_id == int(student_id),
            func.date(HealthRecord.recorded_at) == on_date,
        )
        .order_by(HealthRecord.recorded_at.desc())
        .all()
    )
    return [record.to_dict() for record in records]
