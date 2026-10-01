"""Student lifecycle: create, update, verify, block, assign room/parent."""

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload

from ..constants import (
    AccountStatus,
    AttendanceStatus,
    AuditAction,
    HealthStatus,
    NotificationPriority,
    NotificationType,
    StudentStatus,
    UserRole,
    VerificationStatus,
)
from ..extensions import db
from ..models import (
    AttendanceRecord,
    Bed,
    HealthRecord,
    Parent,
    Room,
    Student,
    StudentParent,
    StudentStatusHistory,
    User,
)
from ..models.base import utcnow
from ..utils.audit import record_audit
from ..utils.errors import BusinessRuleViolation, Conflict, NotFound, ValidationFailed
from ..utils.pagination import paginate_query
from ..utils.security import normalize_email, normalize_phone, validate_password_strength
from ..utils.storage import delete_file, save_image
from . import notification_service


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------
def get_student(student_id, include_inactive=True):
    student = db.session.get(Student, int(student_id))
    if student is None or (not include_inactive and not student.is_active):
        raise NotFound("Student not found")
    return student


def generate_student_code():
    year = date.today().year
    prefix = f"HMS{year}"
    last = db.session.execute(
        select(Student.student_code)
        .where(Student.student_code.like(f"{prefix}%"))
        .order_by(Student.student_code.desc())
        .limit(1)
    ).scalar()
    sequence = 1
    if last:
        tail = last[len(prefix) :]
        if tail.isdigit():
            sequence = int(tail) + 1
    while True:
        candidate = f"{prefix}{sequence:03d}"
        exists = db.session.execute(
            select(Student.id).where(Student.student_code == candidate)
        ).scalar()
        if not exists:
            return candidate
        sequence += 1


def today_attendance_map(student_ids, on_date=None):
    on_date = on_date or date.today()
    if not student_ids:
        return {}
    rows = db.session.execute(
        select(AttendanceRecord.student_id, AttendanceRecord.status)
        .where(
            AttendanceRecord.date == on_date,
            AttendanceRecord.student_id.in_(student_ids),
        )
        .order_by(AttendanceRecord.marked_at.asc())
    ).all()
    return {row[0]: row[1].value for row in rows}


def latest_health_map(student_ids):
    if not student_ids:
        return {}
    newest = (
        select(
            HealthRecord.student_id.label("student_id"),
            func.max(HealthRecord.recorded_at).label("recorded_at"),
        )
        .where(HealthRecord.student_id.in_(student_ids))
        .group_by(HealthRecord.student_id)
        .subquery()
    )
    rows = db.session.execute(
        select(HealthRecord.student_id, HealthRecord.status, HealthRecord.recorded_at).join(
            newest,
            (HealthRecord.student_id == newest.c.student_id)
            & (HealthRecord.recorded_at == newest.c.recorded_at),
        )
    ).all()
    return {row[0]: row[1].value for row in rows}


def decorate_students(students, on_date=None):
    """Attach today's attendance and the latest health status to a list."""
    ids = [student.id for student in students]
    attendance = today_attendance_map(ids, on_date)
    health = latest_health_map(ids)
    payload = []
    for student in students:
        data = student.to_dict()
        data["today_attendance"] = attendance.get(student.id)
        data["health_status"] = health.get(student.id, HealthStatus.HEALTHY.value)
        payload.append(data)
    return payload


# ---------------------------------------------------------------------------
# Listing / search
# ---------------------------------------------------------------------------
def list_students(filters, page=None, per_page=None, restrict_ids=None):
    query = Student.query.options(
        joinedload(Student.bed).joinedload(Bed.room),
        joinedload(Student.parent_links).joinedload(StudentParent.parent).joinedload(Parent.user),
        joinedload(Student.user),
    )

    if restrict_ids is not None:
        if not restrict_ids:
            return [], 1, per_page or 20, 0
        query = query.filter(Student.id.in_(restrict_ids))

    search = (filters.get("q") or "").strip()
    if search:
        pattern = f"%{search.lower()}%"
        parent_subquery = (
            select(StudentParent.student_id)
            .join(Parent, Parent.id == StudentParent.parent_id)
            .join(User, User.id == Parent.user_id)
            .where(
                or_(
                    func.lower(User.full_name).like(pattern),
                    func.lower(User.email).like(pattern),
                    User.phone.like(f"%{search}%"),
                )
            )
        )
        room_subquery = (
            select(Bed.id)
            .join(Room, Room.id == Bed.room_id)
            .where(
                or_(
                    func.lower(Room.room_number).like(pattern),
                    func.lower(Room.building).like(pattern),
                )
            )
        )
        query = query.filter(
            or_(
                func.lower(Student.full_name).like(pattern),
                func.lower(Student.student_code).like(pattern),
                func.lower(Student.school_name).like(pattern),
                func.lower(Student.student_class).like(pattern),
                Student.phone.like(f"%{search}%"),
                Student.id.in_(parent_subquery),
                Student.bed_id.in_(room_subquery),
            )
        )

    if filters.get("student_class"):
        query = query.filter(Student.student_class == filters["student_class"])
    if filters.get("school"):
        query = query.filter(func.lower(Student.school_name) == filters["school"].lower())
    if filters.get("room_id"):
        bed_ids = select(Bed.id).where(Bed.room_id == int(filters["room_id"]))
        query = query.filter(Student.bed_id.in_(bed_ids))
    if filters.get("verification_status"):
        status = VerificationStatus.coerce(filters["verification_status"])
        if status:
            query = query.filter(Student.verification_status == status)
    if filters.get("current_status"):
        status = StudentStatus.coerce(filters["current_status"])
        if status:
            query = query.filter(Student.current_status == status)
    if filters.get("has_login") is not None:
        if filters["has_login"]:
            query = query.filter(Student.user_id.isnot(None))
        else:
            query = query.filter(Student.user_id.is_(None))
    if filters.get("unassigned"):
        query = query.filter(Student.bed_id.is_(None))

    is_active = filters.get("is_active")
    if is_active is None:
        query = query.filter(Student.is_active.is_(True))
    elif is_active is not False or is_active is False:
        query = query.filter(Student.is_active.is_(bool(is_active)))

    if filters.get("attendance"):
        status = AttendanceStatus.coerce(filters["attendance"])
        on_date = filters.get("date") or date.today()
        if status:
            attended = select(AttendanceRecord.student_id).where(
                AttendanceRecord.date == on_date, AttendanceRecord.status == status
            )
            query = query.filter(Student.id.in_(attended))
        elif str(filters["attendance"]).upper() == "NOT_MARKED":
            marked = select(AttendanceRecord.student_id).where(AttendanceRecord.date == on_date)
            query = query.filter(~Student.id.in_(marked))

    if filters.get("health"):
        status = HealthStatus.coerce(filters["health"])
        if status:
            newest = (
                select(
                    HealthRecord.student_id.label("sid"),
                    func.max(HealthRecord.recorded_at).label("ts"),
                )
                .group_by(HealthRecord.student_id)
                .subquery()
            )
            matching = (
                select(HealthRecord.student_id)
                .join(
                    newest,
                    (HealthRecord.student_id == newest.c.sid)
                    & (HealthRecord.recorded_at == newest.c.ts),
                )
                .where(HealthRecord.status == status)
            )
            if status == HealthStatus.HEALTHY:
                any_record = select(HealthRecord.student_id)
                query = query.filter(
                    or_(Student.id.in_(matching), ~Student.id.in_(any_record))
                )
            else:
                query = query.filter(Student.id.in_(matching))

    sort_by = filters.get("sort_by") or "full_name"
    column = {
        "full_name": Student.full_name,
        "student_code": Student.student_code,
        "student_class": Student.student_class,
        "created_at": Student.created_at,
        "admission_date": Student.admission_date,
    }.get(sort_by, Student.full_name)
    descending = (filters.get("sort_dir") or "asc").lower() == "desc"
    query = query.order_by(column.desc() if descending else column.asc())

    items, page, per_page, total = paginate_query(query, page, per_page)
    return decorate_students(items, filters.get("date")), page, per_page, total


# ---------------------------------------------------------------------------
# Create / update
# ---------------------------------------------------------------------------
def _assign_bed_internal(student, bed_id, actor=None):
    if bed_id in (None, ""):
        if student.bed_id:
            previous = student.bed
            student.bed_id = None
            record_audit(
                AuditAction.BED_RELEASED,
                actor=actor,
                entity_type="student",
                entity_id=student.id,
                description=f"Released bed {previous.bed_number} in room "
                f"{previous.room.room_number}" if previous and previous.room else "Released bed",
            )
        return None

    bed = db.session.get(Bed, int(bed_id))
    if bed is None:
        raise NotFound("Bed not found")
    if not bed.is_active:
        raise BusinessRuleViolation("This bed is marked inactive and cannot be assigned.")
    occupant = db.session.execute(
        select(Student.id, Student.full_name).where(
            Student.bed_id == bed.id, Student.id != (student.id or 0)
        )
    ).first()
    if occupant:
        raise Conflict(f"This bed is already occupied by {occupant[1]}.")
    student.bed_id = bed.id
    record_audit(
        AuditAction.BED_ASSIGNED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        description=f"Assigned bed {bed.bed_number} in room {bed.room.room_number}"
        if bed.room
        else f"Assigned bed {bed.bed_number}",
    )
    return bed


def create_student(data, actor=None):
    code = (data.get("student_code") or "").strip() or generate_student_code()
    if db.session.execute(select(Student.id).where(Student.student_code == code)).scalar():
        raise Conflict(f"Student ID '{code}' is already in use.")

    student = Student(
        student_code=code,
        full_name=data["full_name"],
        date_of_birth=data.get("date_of_birth"),
        gender=data.get("gender"),
        blood_group=data.get("blood_group"),
        student_class=data.get("student_class"),
        section=data.get("section"),
        school_name=data.get("school_name"),
        phone=normalize_phone(data.get("phone")),
        email=normalize_email(data.get("email")) or None,
        admission_date=data.get("admission_date") or date.today(),
        emergency_contact_name=data.get("emergency_contact_name"),
        emergency_contact_phone=normalize_phone(data.get("emergency_contact_phone")),
        emergency_contact_relation=data.get("emergency_contact_relation"),
        notes=data.get("notes"),
        verification_status=data.get("verification_status") or VerificationStatus.VERIFIED,
        current_status=StudentStatus.IN_HOSTEL,
        status_updated_at=utcnow(),
    )
    if student.verification_status == VerificationStatus.VERIFIED:
        student.verified_at = utcnow()
        student.verified_by_id = getattr(actor, "id", None)

    db.session.add(student)
    db.session.flush()

    if data.get("bed_id"):
        _assign_bed_internal(student, data["bed_id"], actor)

    for parent_id in data.get("parent_ids") or []:
        link_parent(student, parent_id, actor=actor, commit=False)

    if data.get("create_account"):
        create_student_account(
            student,
            {
                "email": data.get("account_email") or data.get("email"),
                "password": data.get("account_password"),
            },
            actor=actor,
            commit=False,
        )

    db.session.add(
        StudentStatusHistory(
            student_id=student.id,
            status=StudentStatus.IN_HOSTEL,
            updated_by_id=getattr(actor, "id", None),
            remarks="Student admitted to hostel",
        )
    )
    record_audit(
        AuditAction.STUDENT_CREATED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        description=f"Created student {student.full_name} ({student.student_code})",
    )
    db.session.commit()
    return student


def update_student(student, data, actor=None):
    editable = (
        "full_name",
        "date_of_birth",
        "gender",
        "blood_group",
        "student_class",
        "section",
        "school_name",
        "admission_date",
        "emergency_contact_name",
        "emergency_contact_relation",
        "notes",
    )
    changes = []
    for field in editable:
        if field in data:
            if getattr(student, field) != data[field]:
                changes.append(field)
            setattr(student, field, data[field])
    if "phone" in data:
        student.phone = normalize_phone(data["phone"])
        changes.append("phone")
    if "email" in data:
        student.email = normalize_email(data["email"]) or None
        changes.append("email")
    if "emergency_contact_phone" in data:
        student.emergency_contact_phone = normalize_phone(data["emergency_contact_phone"])
        changes.append("emergency_contact_phone")

    record_audit(
        AuditAction.STUDENT_UPDATED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        description=f"Updated {student.full_name}: {', '.join(changes) or 'no changes'}",
    )
    db.session.commit()
    return student


def upload_photo(student, file_storage, actor=None):
    previous = student.profile_photo
    student.profile_photo = save_image(file_storage, "students", field="photo")
    record_audit(
        AuditAction.STUDENT_UPDATED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        description=f"Updated profile photo for {student.full_name}",
    )
    db.session.commit()
    if previous:
        delete_file(previous)
    return student


# ---------------------------------------------------------------------------
# Verification / blocking / removal
# ---------------------------------------------------------------------------
def verify_student(student, actor=None):
    student.verification_status = VerificationStatus.VERIFIED
    student.verified_at = utcnow()
    student.verified_by_id = getattr(actor, "id", None)
    if student.user and student.user.account_status == AccountStatus.PENDING_VERIFICATION:
        student.user.account_status = AccountStatus.ACTIVE
    record_audit(
        AuditAction.STUDENT_VERIFIED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        affected_user=student.user,
        description=f"Verified student {student.full_name} ({student.student_code})",
    )
    db.session.commit()
    return student


def block_student(student, reason=None, actor=None):
    if student.user:
        student.user.account_status = AccountStatus.BLOCKED
    student.is_active = True  # blocking only affects login, records stay live
    record_audit(
        AuditAction.STUDENT_BLOCKED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        affected_user=student.user,
        description=f"Blocked student {student.full_name}"
        + (f": {reason}" if reason else ""),
    )
    db.session.commit()
    return student


def unblock_student(student, actor=None):
    if student.user:
        student.user.account_status = AccountStatus.ACTIVE
    record_audit(
        AuditAction.STUDENT_UNBLOCKED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        affected_user=student.user,
        description=f"Unblocked student {student.full_name}",
    )
    db.session.commit()
    return student


def archive_student(student, actor=None, reason=None):
    """Soft delete: keep every historical record, free the bed, disable login."""
    student.is_active = False
    student.archived_at = utcnow()
    student.bed_id = None
    if student.user:
        student.user.account_status = AccountStatus.INACTIVE
    record_audit(
        AuditAction.STUDENT_REMOVED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        affected_user=student.user,
        description=f"Archived student {student.full_name} ({student.student_code})"
        + (f": {reason}" if reason else ""),
    )
    db.session.commit()
    return student


def restore_student(student, actor=None):
    student.is_active = True
    student.archived_at = None
    if student.user:
        student.user.account_status = AccountStatus.ACTIVE
    record_audit(
        AuditAction.STUDENT_UPDATED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        description=f"Restored student {student.full_name}",
    )
    db.session.commit()
    return student


# ---------------------------------------------------------------------------
# Relationships
# ---------------------------------------------------------------------------
def link_parent(student, parent_id, relationship_type=None, is_primary=False, actor=None, commit=True):
    parent = db.session.get(Parent, int(parent_id))
    if parent is None:
        raise NotFound("Parent not found")
    existing = db.session.execute(
        select(StudentParent).where(
            StudentParent.student_id == student.id, StudentParent.parent_id == parent.id
        )
    ).scalars().first()
    if existing:
        raise Conflict("This parent is already linked to the student.")

    if is_primary:
        for link in student.parent_links:
            link.is_primary = False

    link = StudentParent(
        student_id=student.id,
        parent_id=parent.id,
        relationship_type=relationship_type or parent.relationship_to_student,
        is_primary=is_primary or not student.parent_links,
    )
    db.session.add(link)
    record_audit(
        AuditAction.PARENT_LINKED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        affected_user=parent.user,
        description=f"Linked parent {parent.user.full_name if parent.user else parent.id} "
        f"to student {student.full_name}",
    )
    if commit:
        db.session.commit()
    return link


def unlink_parent(student, parent_id, actor=None):
    link = db.session.execute(
        select(StudentParent).where(
            StudentParent.student_id == student.id, StudentParent.parent_id == int(parent_id)
        )
    ).scalars().first()
    if link is None:
        raise NotFound("This parent is not linked to the student.")
    parent = link.parent
    db.session.delete(link)
    record_audit(
        AuditAction.PARENT_UNLINKED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        affected_user=parent.user if parent else None,
        description=f"Unlinked parent from student {student.full_name}",
    )
    db.session.commit()
    return True


def assign_bed(student, bed_id, actor=None):
    _assign_bed_internal(student, bed_id, actor)
    db.session.commit()
    return student


# ---------------------------------------------------------------------------
# Optional student login account
# ---------------------------------------------------------------------------
def create_student_account(student, data, actor=None, commit=True):
    if student.user_id:
        raise Conflict("This student already has a login account.")
    email = normalize_email(data.get("email"))
    if not email:
        raise ValidationFailed(
            "An email address is required.", errors={"email": ["This field is required."]}
        )
    password = data.get("password")
    problems = validate_password_strength(password)
    if problems:
        raise ValidationFailed("Password is too weak.", errors={"password": problems})
    if db.session.execute(select(User.id).where(User.email == email)).scalar():
        raise Conflict("An account with this email address already exists.")

    username = (data.get("username") or student.student_code).strip()
    if db.session.execute(select(User.id).where(User.username == username)).scalar():
        username = None

    user = User(
        full_name=student.full_name,
        email=email,
        username=username,
        phone=student.phone,
        role=UserRole.STUDENT,
        account_status=AccountStatus.ACTIVE,
        is_email_verified=True,
        profile_photo=student.profile_photo,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    student.user_id = user.id
    if not student.email:
        student.email = email

    record_audit(
        AuditAction.STUDENT_ACCOUNT_CREATED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        affected_user=user,
        description=f"Created login account for {student.full_name}",
    )
    if commit:
        db.session.commit()
    return user


def revoke_student_account(student, actor=None):
    if not student.user_id:
        raise NotFound("This student does not have a login account.")
    user = student.user
    student.user_id = None
    db.session.flush()
    if user:
        db.session.delete(user)
    record_audit(
        AuditAction.STUDENT_UPDATED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        description=f"Removed login account for {student.full_name}",
    )
    db.session.commit()
    return True


# ---------------------------------------------------------------------------
# Activity status (consent based - never hidden GPS)
# ---------------------------------------------------------------------------
def change_status(student, status, remarks=None, actor=None):
    status = StudentStatus.coerce(status)
    if status is None:
        raise ValidationFailed("Unknown student status.")
    student.current_status = status
    student.status_updated_at = utcnow()
    history = StudentStatusHistory(
        student_id=student.id,
        status=status,
        updated_by_id=getattr(actor, "id", None),
        remarks=remarks,
    )
    db.session.add(history)
    record_audit(
        AuditAction.STATUS_CHANGED,
        actor=actor,
        entity_type="student",
        entity_id=student.id,
        description=f"{student.full_name} status set to {status.value}",
    )
    label = status.value.replace("_", " ").title()
    notification_service.notify_student_guardians(
        student,
        NotificationType.ACTIVITY_UPDATE,
        "Status update",
        f"{student.full_name} is now marked as: {label}."
        + (f" Note: {remarks}" if remarks else ""),
        priority=NotificationPriority.NORMAL,
        link=f"/parent/children/{student.id}/daily-activity",
        created_by=actor,
        include_student_account=False,
    )
    db.session.commit()
    return history


def status_timeline(student, limit=50):
    rows = (
        StudentStatusHistory.query.filter(StudentStatusHistory.student_id == student.id)
        .order_by(StudentStatusHistory.changed_at.desc())
        .limit(limit)
        .all()
    )
    return [row.to_dict() for row in rows]


# ---------------------------------------------------------------------------
# Filter option helpers for the UI
# ---------------------------------------------------------------------------
def filter_options():
    classes = db.session.execute(
        select(Student.student_class)
        .where(Student.student_class.isnot(None), Student.is_active.is_(True))
        .distinct()
        .order_by(Student.student_class)
    ).scalars().all()
    schools = db.session.execute(
        select(Student.school_name)
        .where(Student.school_name.isnot(None), Student.is_active.is_(True))
        .distinct()
        .order_by(Student.school_name)
    ).scalars().all()
    rooms = db.session.execute(
        select(Room.id, Room.building, Room.room_number)
        .where(Room.is_active.is_(True))
        .order_by(Room.building, Room.room_number)
    ).all()
    return {
        "classes": [c for c in classes if c],
        "schools": [s for s in schools if s],
        "rooms": [
            {"id": row[0], "label": f"{row[1]} / {row[2]}", "room_number": row[2]} for row in rooms
        ],
        "attendance_statuses": AttendanceStatus.values() + ["NOT_MARKED"],
        "health_statuses": HealthStatus.values(),
        "verification_statuses": VerificationStatus.values(),
        "student_statuses": StudentStatus.values(),
    }
