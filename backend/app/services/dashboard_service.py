"""Aggregated dashboard payloads for each role."""

from datetime import date, timedelta

from sqlalchemy import func, select

from ..constants import (
    AccountStatus,
    HealthStatus,
    StudentStatus,
    SuggestionStatus,
    UserRole,
    VerificationStatus,
)
from ..extensions import db
from ..models import AuditLog, Parent, Student, Suggestion, User
from . import (
    activity_service,
    attendance_service,
    communication_service,
    health_service,
    meal_service,
    notification_service,
    progress_service,
    room_service,
    school_service,
)


def _count(stmt):
    return db.session.execute(stmt).scalar() or 0


def admin_summary():
    today = date.today()
    attendance = attendance_service.today_counts()
    health = health_service.hostel_overview()
    school = school_service.today_counts()

    total_students = _count(
        select(func.count(Student.id)).where(Student.is_active.is_(True))
    )
    total_parents = _count(
        select(func.count(Parent.id))
        .join(User, User.id == Parent.user_id)
        .where(User.account_status != AccountStatus.INACTIVE)
    )
    pending_parents = _count(
        select(func.count(Parent.id)).where(
            Parent.verification_status == VerificationStatus.PENDING
        )
    )
    pending_students = _count(
        select(func.count(Student.id)).where(
            Student.verification_status == VerificationStatus.PENDING,
            Student.is_active.is_(True),
        )
    )
    in_hostel = _count(
        select(func.count(Student.id)).where(
            Student.is_active.is_(True),
            Student.current_status.in_(
                [StudentStatus.IN_HOSTEL, StudentStatus.RETURNED_TO_HOSTEL]
            ),
        )
    )
    at_school = _count(
        select(func.count(Student.id)).where(
            Student.is_active.is_(True), Student.current_status == StudentStatus.AT_SCHOOL
        )
    )
    pending_suggestions = _count(
        select(func.count(Suggestion.id)).where(
            Suggestion.status.in_(
                [
                    SuggestionStatus.NEW,
                    SuggestionStatus.UNDER_REVIEW,
                    SuggestionStatus.IN_PROGRESS,
                ]
            )
        )
    )

    sick_count = (
        health[HealthStatus.SICK.value]
        + health[HealthStatus.FEELING_UNWELL.value]
        + health[HealthStatus.MEDICAL_OBSERVATION.value]
        + health[HealthStatus.HOSPITALIZED.value]
    )

    return {
        "date": today.isoformat(),
        "total_students": total_students,
        "total_parents": total_parents,
        "pending_parent_verification": pending_parents,
        "pending_student_verification": pending_students,
        "students_present": attendance.get("PRESENT", 0) + attendance.get("LATE", 0),
        "students_absent": attendance.get("ABSENT", 0),
        "students_on_leave": attendance.get("LEAVE", 0),
        "attendance_not_marked": attendance.get("NOT_MARKED", 0),
        "students_sick": sick_count,
        "students_at_school": at_school or school.get("WENT_TO_SCHOOL", 0),
        "students_inside_hostel": in_hostel,
        "active_alerts": communication_service.active_alert_count(),
        "pending_suggestions": pending_suggestions,
    }


def admin_dashboard():
    today = date.today()
    start = today - timedelta(days=13)
    occupancy = room_service.occupancy_summary()
    return {
        "summary": admin_summary(),
        "charts": {
            "attendance_trend": attendance_service.daily_trend(start, today),
            "health_distribution": [
                {"status": status, "label": status.replace("_", " ").title(), "count": count}
                for status, count in health_service.hostel_overview().items()
                if status in HealthStatus.values()
            ],
            "occupancy_by_building": room_service.occupancy_by_building(),
            "school_attendance_weekly": school_service.weekly_counts(
                today - timedelta(days=6), today
            ),
        },
        "occupancy": occupancy,
        "activity_stats": activity_service.completion_stats(today),
        "recent_activity": activity_service.recent_hostel_activity(limit=10),
        "health_cases": health_service.active_cases(limit=8),
        "today_meals": meal_service.day_menu(today),
        "suggestion_stats": communication_service.suggestion_stats(),
        "recent_audit": [
            entry.to_dict()
            for entry in AuditLog.query.order_by(AuditLog.created_at.desc()).limit(8).all()
        ],
    }


def child_today_snapshot(student):
    today = date.today()
    attendance_record = next(
        (
            record.to_dict()
            for record in student.attendance_records
            if record.date == today
        ),
        None,
    )
    return {
        "student": student.to_summary(),
        "attendance": attendance_record,
        "school": school_service.status_for_date(student.id, today),
        "health": health_service.current_status(student.id),
        "timeline": activity_service.timeline(student.id, today),
        "meals": meal_service.day_menu(today),
        "status": {
            "current": student.current_status.value,
            "label": student.current_status.value.replace("_", " ").title(),
            "updated_at": student.status_updated_at.isoformat() + "Z"
            if student.status_updated_at
            else None,
        },
    }


def parent_dashboard(parent, student_id=None):
    from . import parent_service

    children = parent_service.children_payload(parent)
    if not children:
        return {
            "children": [],
            "selected_child": None,
            "notifications": notification_service.recent_for_user(parent.user, limit=8),
            "unread_notifications": notification_service.unread_count(parent.user),
            "announcements": communication_service.announcements_for_user(parent.user, limit=5),
            "emergency_alerts": communication_service.active_alerts_for_user(parent.user),
            "suggestions": [],
        }

    child_ids = [child["id"] for child in children]
    selected_id = int(student_id) if student_id and int(student_id) in child_ids else child_ids[0]
    student = db.session.get(Student, selected_id)

    today = date.today()
    snapshot = child_today_snapshot(student)
    progress = progress_service.current_progress(student.id)
    attendance_month = attendance_service.monthly_summary(student.id, today.year, today.month)

    suggestions, *_ = communication_service.list_suggestions(
        {}, page=1, per_page=5, parent_id=parent.id
    )

    return {
        "children": children,
        "selected_child_id": selected_id,
        "selected_child": snapshot,
        "progress": progress,
        "attendance_month": attendance_month,
        "attendance_trend": attendance_service.monthly_trend(student.id, months=6),
        "notifications": notification_service.recent_for_user(parent.user, limit=8),
        "unread_notifications": notification_service.unread_count(parent.user),
        "announcements": communication_service.announcements_for_user(parent.user, limit=5),
        "emergency_alerts": communication_service.active_alerts_for_user(parent.user),
        "suggestions": suggestions,
    }


def student_dashboard(student):
    today = date.today()
    user = student.user
    return {
        "student": student.to_dict(include_parents=True),
        "today": child_today_snapshot(student),
        "attendance_month": attendance_service.monthly_summary(student.id, today.year, today.month),
        "progress": progress_service.current_progress(student.id),
        "subjects": progress_service.subject_averages(student.id),
        "notifications": notification_service.recent_for_user(user, limit=8) if user else [],
        "unread_notifications": notification_service.unread_count(user) if user else 0,
        "announcements": communication_service.announcements_for_user(user, limit=5) if user else [],
        "emergency_alerts": communication_service.active_alerts_for_user(user) if user else [],
    }


def global_search(term, limit=8):
    """Admin global search across students, parents and rooms."""
    from ..models import Bed, Room, StudentParent

    pattern = f"%{term.lower()}%"
    students = (
        Student.query.filter(
            Student.is_active.is_(True),
            func.lower(Student.full_name).like(pattern)
            | func.lower(Student.student_code).like(pattern)
            | func.lower(Student.school_name).like(pattern),
        )
        .order_by(Student.full_name)
        .limit(limit)
        .all()
    )
    parents = (
        Parent.query.join(User, User.id == Parent.user_id)
        .filter(
            func.lower(User.full_name).like(pattern)
            | func.lower(User.email).like(pattern)
            | User.phone.like(f"%{term}%")
        )
        .order_by(User.full_name)
        .limit(limit)
        .all()
    )
    rooms = (
        Room.query.filter(
            func.lower(Room.room_number).like(pattern) | func.lower(Room.building).like(pattern)
        )
        .order_by(Room.building, Room.room_number)
        .limit(limit)
        .all()
    )
    return {
        "students": [student.to_summary() for student in students],
        "parents": [
            {
                "id": parent.id,
                "full_name": parent.user.full_name if parent.user else None,
                "phone": parent.user.phone if parent.user else None,
                "email": parent.user.email if parent.user else None,
                "verification_status": parent.verification_status.value,
            }
            for parent in parents
        ],
        "rooms": [
            {
                "id": room.id,
                "label": room.label,
                "occupied_beds": room.occupied_beds,
                "available_beds": room.available_beds,
            }
            for room in rooms
        ],
    }


def audit_log_page(filters, page=None, per_page=None):
    from ..utils.pagination import paginate_query

    query = AuditLog.query
    if filters.get("action"):
        query = query.filter(AuditLog.action == filters["action"])
    if filters.get("admin_id"):
        query = query.filter(AuditLog.admin_id == int(filters["admin_id"]))
    if filters.get("entity_type"):
        query = query.filter(AuditLog.entity_type == filters["entity_type"])
    if filters.get("start_date"):
        query = query.filter(func.date(AuditLog.created_at) >= filters["start_date"])
    if filters.get("end_date"):
        query = query.filter(func.date(AuditLog.created_at) <= filters["end_date"])
    query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    return paginate_query(query, page, per_page, serializer=lambda entry: entry.to_dict())


def user_counts_by_role():
    rows = db.session.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    ).all()
    counts = {role.value: 0 for role in UserRole}
    for role, total in rows:
        counts[role.value] = total
    return counts
