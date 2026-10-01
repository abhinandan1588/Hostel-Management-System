"""Report builders shared by the JSON, CSV and PDF report endpoints.

Each builder returns ``(title, headers, rows)`` so the route layer can render
the same dataset in any format.
"""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..constants import AttendanceSession, AttendanceStatus, HealthStatus, VerificationStatus
from ..extensions import db
from ..models import (
    AcademicProgress,
    AttendanceRecord,
    Bed,
    HealthRecord,
    Meal,
    Parent,
    Room,
    SchoolAttendance,
    Student,
    StudentParent,
    User,
)
from ..utils.dates import format_time_12h
from ..utils.errors import NotFound, ValidationFailed
from . import attendance_service, health_service, progress_service, room_service

REPORT_TYPES = [
    "daily-attendance",
    "monthly-attendance",
    "student-progress",
    "health",
    "meals",
    "school-attendance",
    "parent-list",
    "student-list",
    "hostel-occupancy",
]


def _student_label(student):
    if student is None:
        return "-"
    return f"{student.full_name} ({student.student_code})"


def daily_attendance_report(on_date=None, student_class=None):
    on_date = on_date or date.today()
    sheet = attendance_service.daily_sheet(on_date, AttendanceSession.MORNING, student_class)
    headers = ["Student ID", "Name", "Class", "Room", "Status", "Remarks", "Marked By"]
    rows = [
        [
            row["student_code"],
            row["full_name"],
            row["student_class"],
            row["room_number"] or "-",
            row["status"] or "NOT MARKED",
            row["remarks"] or "",
            row["marked_by"] or "",
        ]
        for row in sheet["rows"]
    ]
    title = f"Daily Attendance Report - {on_date:%d %b %Y}"
    return title, headers, rows, {"summary": sheet["counts"], "date": on_date.isoformat()}


def monthly_attendance_report(year=None, month=None, student_class=None):
    today = date.today()
    year = int(year or today.year)
    month = int(month or today.month)
    query = Student.query.filter(Student.is_active.is_(True))
    if student_class:
        query = query.filter(Student.student_class == student_class)
    students = query.order_by(Student.full_name).all()

    headers = [
        "Student ID",
        "Name",
        "Class",
        "Present",
        "Absent",
        "Leave",
        "Late",
        "Recorded Days",
        "Attendance %",
    ]
    rows = []
    for student in students:
        summary = attendance_service.monthly_summary(student.id, year, month)
        rows.append(
            [
                student.student_code,
                student.full_name,
                student.student_class,
                summary["present"],
                summary["absent"],
                summary["leave"],
                summary["late"],
                summary["recorded_days"],
                summary["attendance_percentage"],
            ]
        )
    title = f"Monthly Attendance Report - {date(year, month, 1):%B %Y}"
    return title, headers, rows, {"year": year, "month": month}


def student_progress_report(student_id=None, student_class=None):
    if student_id:
        student = db.session.get(Student, int(student_id))
        if student is None:
            raise NotFound("Student not found")
        records = (
            AcademicProgress.query.filter(AcademicProgress.student_id == student.id)
            .order_by(AcademicProgress.exam_date.desc())
            .all()
        )
        headers = [
            "Subject",
            "Exam",
            "Type",
            "Marks",
            "Max",
            "Percentage",
            "Grade",
            "Date",
            "Remark",
        ]
        rows = [
            [
                record.subject,
                record.exam_name,
                record.exam_type or "",
                float(record.marks_obtained),
                float(record.max_marks),
                float(record.percentage),
                record.grade,
                record.exam_date.isoformat() if record.exam_date else "",
                record.teacher_remark or "",
            ]
            for record in records
        ]
        overview = progress_service.overview(student.id)
        return (
            f"Progress Report - {_student_label(student)}",
            headers,
            rows,
            {"student": student.to_summary(), "overview": overview},
        )

    query = Student.query.filter(Student.is_active.is_(True))
    if student_class:
        query = query.filter(Student.student_class == student_class)
    students = query.order_by(Student.full_name).all()
    headers = ["Student ID", "Name", "Class", "Overall Progress %", "Attendance %", "Exams Recorded"]
    rows = []
    for student in students:
        progress = progress_service.current_progress(student.id)
        exams = db.session.execute(
            select(func.count(AcademicProgress.id)).where(
                AcademicProgress.student_id == student.id
            )
        ).scalar() or 0
        attendance_rows = db.session.execute(
            select(AttendanceRecord.status, func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == student.id)
            .group_by(AttendanceRecord.status)
        ).all()
        counts = {status.value: 0 for status in AttendanceStatus}
        for status, total in attendance_rows:
            counts[status.value] = total
        recorded = sum(counts.values())
        attendance_pct = (
            round(((counts["PRESENT"] + counts["LATE"]) / recorded) * 100, 2) if recorded else 0.0
        )
        rows.append(
            [
                student.student_code,
                student.full_name,
                student.student_class,
                progress["overall"] if progress["overall"] is not None else "-",
                attendance_pct,
                exams,
            ]
        )
    return "Student Progress Report", headers, rows, {}


def health_report(start_date=None, end_date=None, status=None):
    query = HealthRecord.query.options(joinedload(HealthRecord.student))
    if start_date:
        query = query.filter(func.date(HealthRecord.recorded_at) >= start_date)
    if end_date:
        query = query.filter(func.date(HealthRecord.recorded_at) <= end_date)
    coerced = HealthStatus.coerce(status)
    if coerced:
        query = query.filter(HealthRecord.status == coerced)
    records = query.order_by(HealthRecord.recorded_at.desc()).all()

    headers = [
        "Date",
        "Student ID",
        "Name",
        "Status",
        "Severity",
        "Symptoms",
        "Temp (C)",
        "Medicine",
        "Doctor",
        "Hospital",
        "Recovery",
    ]
    rows = [
        [
            record.recorded_at.strftime("%Y-%m-%d %H:%M"),
            record.student.student_code if record.student else "",
            record.student.full_name if record.student else "",
            record.status.value,
            record.severity.value,
            record.symptoms or "",
            float(record.temperature) if record.temperature else "",
            record.medicine_given or "",
            record.doctor_name or ("Yes" if record.doctor_visited else ""),
            record.hospital_name or ("Yes" if record.hospital_visit else ""),
            record.recovery_status.value,
        ]
        for record in records
    ]
    return "Health Report", headers, rows, {"overview": health_service.hostel_overview()}


def meal_report(start_date=None, end_date=None):
    query = Meal.query
    if start_date:
        query = query.filter(Meal.date >= start_date)
    if end_date:
        query = query.filter(Meal.date <= end_date)
    meals = query.order_by(Meal.date.desc(), Meal.meal_type).all()
    headers = ["Date", "Meal", "Name", "Food Items", "Served At", "Photos", "Remarks"]
    rows = [
        [
            meal.date.isoformat(),
            meal.meal_type.value,
            meal.name or "",
            ", ".join(meal.item_list),
            format_time_12h(meal.served_at) or "",
            len(meal.photos),
            meal.remarks or "",
        ]
        for meal in meals
    ]
    return "Meal Report", headers, rows, {}


def school_attendance_report(start_date=None, end_date=None, student_class=None):
    query = SchoolAttendance.query.options(joinedload(SchoolAttendance.student))
    if start_date:
        query = query.filter(SchoolAttendance.date >= start_date)
    if end_date:
        query = query.filter(SchoolAttendance.date <= end_date)
    if student_class:
        matching = select(Student.id).where(Student.student_class == student_class)
        query = query.filter(SchoolAttendance.student_id.in_(matching))
    records = query.order_by(SchoolAttendance.date.desc()).all()
    headers = [
        "Date",
        "Student ID",
        "Name",
        "Class",
        "Status",
        "Departure",
        "Expected Return",
        "Actual Return",
        "Remarks",
    ]
    rows = [
        [
            record.date.isoformat(),
            record.student.student_code if record.student else "",
            record.student.full_name if record.student else "",
            record.student.student_class if record.student else "",
            record.status.value,
            format_time_12h(record.departure_time) or "",
            format_time_12h(record.expected_return_time) or "",
            format_time_12h(record.actual_return_time) or "",
            record.remarks or "",
        ]
        for record in records
    ]
    return "School Attendance Report", headers, rows, {}


def parent_list_report(verification_status=None):
    query = Parent.query.options(joinedload(Parent.user)).join(User, User.id == Parent.user_id)
    coerced = VerificationStatus.coerce(verification_status)
    if coerced:
        query = query.filter(Parent.verification_status == coerced)
    parents = query.order_by(User.full_name).all()
    headers = [
        "Parent Name",
        "Phone",
        "Email",
        "Relationship",
        "Children",
        "Verification",
        "Account Status",
        "Registered",
    ]
    rows = [
        [
            parent.user.full_name if parent.user else "",
            parent.user.phone if parent.user else "",
            parent.user.email if parent.user else "",
            parent.relationship_to_student or "",
            ", ".join(child.full_name for child in parent.children) or "-",
            parent.verification_status.value,
            parent.user.account_status.value if parent.user else "",
            parent.created_at.strftime("%Y-%m-%d"),
        ]
        for parent in parents
    ]
    return "Parent List", headers, rows, {}


def student_list_report(student_class=None, include_inactive=False):
    query = Student.query.options(
        joinedload(Student.bed).joinedload(Bed.room),
        joinedload(Student.parent_links).joinedload(StudentParent.parent).joinedload(Parent.user),
    )
    if not include_inactive:
        query = query.filter(Student.is_active.is_(True))
    if student_class:
        query = query.filter(Student.student_class == student_class)
    students = query.order_by(Student.full_name).all()
    headers = [
        "Student ID",
        "Name",
        "Class",
        "School",
        "Building",
        "Room",
        "Bed",
        "Primary Parent",
        "Parent Phone",
        "Status",
        "Admission Date",
    ]
    rows = []
    for student in students:
        parent = student.primary_parent
        room = student.room
        rows.append(
            [
                student.student_code,
                student.full_name,
                student.student_class or "",
                student.school_name or "",
                room.building if room else "",
                room.room_number if room else "",
                student.bed.bed_number if student.bed else "",
                parent.user.full_name if parent and parent.user else "",
                parent.user.phone if parent and parent.user else "",
                "Active" if student.is_active else "Archived",
                student.admission_date.isoformat() if student.admission_date else "",
            ]
        )
    return "Student List", headers, rows, {}


def hostel_occupancy_report():
    rooms = (
        Room.query.options(joinedload(Room.beds).joinedload(Bed.student))
        .order_by(Room.building, Room.floor, Room.room_number)
        .all()
    )
    headers = [
        "Building",
        "Floor",
        "Room",
        "Capacity",
        "Total Beds",
        "Occupied",
        "Available",
        "Students",
    ]
    rows = [
        [
            room.building,
            room.floor,
            room.room_number,
            room.capacity,
            len(room.beds),
            room.occupied_beds,
            room.available_beds,
            ", ".join(
                f"{bed.bed_number}: {bed.student.full_name}"
                for bed in room.beds
                if bed.student is not None
            ),
        ]
        for room in rooms
    ]
    return (
        "Hostel Occupancy Report",
        headers,
        rows,
        {"summary": room_service.occupancy_summary()},
    )


BUILDERS = {
    "daily-attendance": lambda p: daily_attendance_report(p.get("date"), p.get("student_class")),
    "monthly-attendance": lambda p: monthly_attendance_report(
        p.get("year"), p.get("month"), p.get("student_class")
    ),
    "student-progress": lambda p: student_progress_report(
        p.get("student_id"), p.get("student_class")
    ),
    "health": lambda p: health_report(p.get("start_date"), p.get("end_date"), p.get("status")),
    "meals": lambda p: meal_report(p.get("start_date"), p.get("end_date")),
    "school-attendance": lambda p: school_attendance_report(
        p.get("start_date"), p.get("end_date"), p.get("student_class")
    ),
    "parent-list": lambda p: parent_list_report(p.get("verification_status")),
    "student-list": lambda p: student_list_report(
        p.get("student_class"), bool(p.get("include_inactive"))
    ),
    "hostel-occupancy": lambda p: hostel_occupancy_report(),
}


def build(report_type, params):
    builder = BUILDERS.get(report_type)
    if builder is None:
        raise ValidationFailed(
            f"Unknown report type '{report_type}'.",
            errors={"report_type": [f"Choose one of: {', '.join(REPORT_TYPES)}"]},
        )
    return builder(params or {})
