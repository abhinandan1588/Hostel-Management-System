"""Development seed script.

Creates a small, realistic (entirely fictional) dataset so every screen in the
frontend has something to show.

Usage:
    flask seed                 # additive, safe to re-run
    flask seed --reset         # drop + recreate all tables first
    python seed.py --reset
"""

import random
import sys
from datetime import date, datetime, time, timedelta

from app import create_app
from app.constants import (
    AccountStatus,
    ActivityType,
    AnnouncementAudience,
    AttendanceSession,
    AttendanceStatus,
    Gender,
    HealthSeverity,
    HealthStatus,
    MealType,
    NotificationPriority,
    NotificationType,
    RecoveryStatus,
    SchoolAttendanceStatus,
    StudentStatus,
    SuggestionCategory,
    SuggestionStatus,
    UserRole,
    VerificationStatus,
)
from app.extensions import db
from app.models import (
    AcademicProgress,
    Announcement,
    AttendanceRecord,
    Bed,
    DailyActivity,
    HealthRecord,
    Meal,
    Notification,
    Parent,
    ProgressCategory,
    ProgressRecord,
    Room,
    SchoolAttendance,
    Student,
    StudentParent,
    StudentStatusHistory,
    Suggestion,
    SuggestionReply,
    User,
)
from app.models.base import utcnow
from app.services import progress_service

random.seed(20260918)

DEMO_PASSWORD = "Password123"

ADMIN = {
    "full_name": "Anita Sharma",
    "email": "admin@hostel.test",
    "phone": "+919800000001",
    "designation": "Chief Warden",
    "hostel_name": "Sunrise Boys & Girls Hostel",
}

PARENTS = [
    {
        "full_name": "Meera Kumar",
        "email": "meera.parent@hostel.test",
        "phone": "+919800000011",
        "address": "14 Lake View Road, Ranchi",
        "city": "Ranchi",
        "relationship": "Mother",
        "occupation": "School Teacher",
        "verification": VerificationStatus.VERIFIED,
        "children": ["HMS2026001", "HMS2026002"],
    },
    {
        "full_name": "Rajesh Verma",
        "email": "rajesh.parent@hostel.test",
        "phone": "+919800000012",
        "address": "88 Station Road, Patna",
        "city": "Patna",
        "relationship": "Father",
        "occupation": "Bank Officer",
        "verification": VerificationStatus.VERIFIED,
        "children": ["HMS2026003"],
    },
    {
        "full_name": "Fatima Ansari",
        "email": "fatima.parent@hostel.test",
        "phone": "+919800000013",
        "address": "5 Green Park, Gaya",
        "city": "Gaya",
        "relationship": "Mother",
        "occupation": "Nurse",
        "verification": VerificationStatus.PENDING,
        "children": ["HMS2026004"],
    },
]

STUDENTS = [
    {
        "code": "HMS2026001",
        "name": "Rahul Kumar",
        "dob": date(2011, 4, 18),
        "gender": Gender.MALE,
        "class": "Class 8",
        "section": "A",
        "school": "St. Xavier's High School",
        "blood_group": "B+",
        "login": "rahul.student@hostel.test",
        "bed": ("A", "101", "1"),
    },
    {
        "code": "HMS2026002",
        "name": "Priya Kumar",
        "dob": date(2013, 9, 2),
        "gender": Gender.FEMALE,
        "class": "Class 6",
        "section": "B",
        "school": "St. Xavier's High School",
        "blood_group": "O+",
        "login": None,
        "bed": ("A", "101", "2"),
    },
    {
        "code": "HMS2026003",
        "name": "Amit Verma",
        "dob": date(2010, 12, 11),
        "gender": Gender.MALE,
        "class": "Class 9",
        "section": "A",
        "school": "Government Senior Secondary School",
        "blood_group": "A+",
        "login": "amit.student@hostel.test",
        "bed": ("A", "102", "1"),
    },
    {
        "code": "HMS2026004",
        "name": "Sana Ansari",
        "dob": date(2012, 6, 25),
        "gender": Gender.FEMALE,
        "class": "Class 7",
        "section": "C",
        "school": "Little Flower School",
        "blood_group": "AB+",
        "login": None,
        "bed": ("A", "102", "2"),
    },
    {
        "code": "HMS2026005",
        "name": "Deepak Oraon",
        "dob": date(2011, 1, 30),
        "gender": Gender.MALE,
        "class": "Class 8",
        "section": "B",
        "school": "Government Senior Secondary School",
        "blood_group": "O-",
        "login": None,
        "bed": ("A", "102", "3"),
    },
]

ROOMS = [
    {"building": "Building A", "floor": 1, "room_number": "101", "capacity": 3, "beds": 3},
    {"building": "Building A", "floor": 1, "room_number": "102", "capacity": 4, "beds": 4},
]

MEAL_PLAN = {
    MealType.BREAKFAST: (time(7, 0), ["Poha", "Boiled Egg", "Banana", "Milk"]),
    MealType.LUNCH: (time(12, 45), ["Rice", "Dal", "Mixed Vegetable", "Curd"]),
    MealType.EVENING_SNACK: (time(17, 0), ["Vegetable Sandwich", "Tea"]),
    MealType.DINNER: (time(20, 0), ["Roti", "Paneer Curry", "Salad", "Kheer"]),
}

SUBJECTS = ["Mathematics", "Science", "English", "Social Science", "Hindi"]

ROUTINE = [
    (ActivityType.WAKE_UP, "Wake Up", time(6, 30)),
    (ActivityType.BREAKFAST, "Breakfast", time(7, 0)),
    (ActivityType.LEFT_FOR_SCHOOL, "Left for School", time(7, 30)),
    (ActivityType.RETURNED_FROM_SCHOOL, "Returned to Hostel", time(14, 15)),
    (ActivityType.LUNCH, "Lunch", time(14, 30)),
    (ActivityType.STUDY, "Study Time", time(16, 0)),
    (ActivityType.OUTDOOR_ACTIVITY, "Outdoor Activity", time(18, 0)),
    (ActivityType.DINNER, "Dinner", time(20, 0)),
    (ActivityType.STUDY, "Night Study", time(21, 0)),
    (ActivityType.LIGHTS_OUT, "Lights Out", time(22, 0)),
]


def _log(message):
    print(f"  {message}")


def _create_admin():
    existing = User.query.filter(User.email == ADMIN["email"]).first()
    if existing:
        return existing
    from app.models import AdminProfile

    user = User(
        full_name=ADMIN["full_name"],
        email=ADMIN["email"],
        phone=ADMIN["phone"],
        username="admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
        is_email_verified=True,
        is_super_admin=True,
    )
    user.set_password(DEMO_PASSWORD)
    db.session.add(user)
    db.session.flush()
    db.session.add(
        AdminProfile(
            user_id=user.id,
            designation=ADMIN["designation"],
            hostel_name=ADMIN["hostel_name"],
        )
    )
    _log(f"admin: {user.email}")
    return user


def _create_rooms():
    created = {}
    for spec in ROOMS:
        room = Room.query.filter_by(
            building=spec["building"], room_number=spec["room_number"]
        ).first()
        if room is None:
            room = Room(
                building=spec["building"],
                floor=spec["floor"],
                room_number=spec["room_number"],
                capacity=spec["capacity"],
                room_type="Standard",
            )
            db.session.add(room)
            db.session.flush()
            for index in range(1, spec["beds"] + 1):
                db.session.add(Bed(room_id=room.id, bed_number=str(index)))
            db.session.flush()
        created[(spec["building"], spec["room_number"])] = room
    _log(f"rooms: {len(created)}")
    return created


def _find_bed(rooms, building_suffix, room_number, bed_number):
    room = rooms.get((f"Building {building_suffix}", room_number))
    if room is None:
        return None
    for bed in room.beds:
        if bed.bed_number == bed_number:
            return bed
    return None


def _create_students(admin, rooms):
    students = {}
    today = date.today()
    for spec in STUDENTS:
        student = Student.query.filter_by(student_code=spec["code"]).first()
        if student is None:
            student = Student(
                student_code=spec["code"],
                full_name=spec["name"],
                date_of_birth=spec["dob"],
                gender=spec["gender"],
                blood_group=spec["blood_group"],
                student_class=spec["class"],
                section=spec["section"],
                school_name=spec["school"],
                admission_date=today - timedelta(days=random.randint(120, 400)),
                emergency_contact_name="Hostel Office",
                emergency_contact_phone="+919800000099",
                emergency_contact_relation="Warden",
                verification_status=VerificationStatus.VERIFIED,
                verified_at=utcnow(),
                verified_by_id=admin.id,
                current_status=StudentStatus.IN_HOSTEL,
                status_updated_at=utcnow(),
            )
            bed = _find_bed(rooms, *spec["bed"])
            if bed is not None:
                student.bed_id = bed.id
            db.session.add(student)
            db.session.flush()
            db.session.add(
                StudentStatusHistory(
                    student_id=student.id,
                    status=StudentStatus.IN_HOSTEL,
                    updated_by_id=admin.id,
                    remarks="Admitted to hostel",
                )
            )

            if spec["login"]:
                account = User(
                    full_name=spec["name"],
                    email=spec["login"],
                    username=spec["code"].lower(),
                    role=UserRole.STUDENT,
                    account_status=AccountStatus.ACTIVE,
                    is_email_verified=True,
                )
                account.set_password(DEMO_PASSWORD)
                db.session.add(account)
                db.session.flush()
                student.user_id = account.id
                student.email = spec["login"]
        students[spec["code"]] = student
    db.session.flush()
    _log(f"students: {len(students)}")
    return students


def _create_parents(admin, students):
    created = []
    for spec in PARENTS:
        user = User.query.filter(User.email == spec["email"]).first()
        if user is None:
            verified = spec["verification"] == VerificationStatus.VERIFIED
            user = User(
                full_name=spec["full_name"],
                email=spec["email"],
                phone=spec["phone"],
                role=UserRole.PARENT,
                account_status=AccountStatus.ACTIVE
                if verified
                else AccountStatus.PENDING_VERIFICATION,
                is_email_verified=verified,
            )
            user.set_password(DEMO_PASSWORD)
            db.session.add(user)
            db.session.flush()

            parent = Parent(
                user_id=user.id,
                address=spec["address"],
                city=spec["city"],
                relationship_to_student=spec["relationship"],
                occupation=spec["occupation"],
                claimed_student_code=spec["children"][0],
                verification_status=spec["verification"],
                verified_at=utcnow() if verified else None,
                verified_by_id=admin.id if verified else None,
            )
            db.session.add(parent)
            db.session.flush()

            for index, code in enumerate(spec["children"]):
                student = students.get(code)
                if student is None:
                    continue
                db.session.add(
                    StudentParent(
                        student_id=student.id,
                        parent_id=parent.id,
                        relationship_type=spec["relationship"],
                        is_primary=index == 0,
                    )
                )
            created.append(parent)
    db.session.flush()
    _log(f"parents: {len(created) or len(PARENTS)}")
    return created


def _seed_attendance(admin, students):
    today = date.today()
    weights = [
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.LATE,
        AttendanceStatus.LEAVE,
        AttendanceStatus.ABSENT,
    ]
    count = 0
    for student in students.values():
        for offset in range(29, -1, -1):
            day = today - timedelta(days=offset)
            if day.weekday() == 6:  # Sunday: no formal roll call
                continue
            exists = AttendanceRecord.query.filter_by(
                student_id=student.id, date=day, session=AttendanceSession.MORNING
            ).first()
            if exists:
                continue
            status = random.choice(weights)
            db.session.add(
                AttendanceRecord(
                    student_id=student.id,
                    date=day,
                    session=AttendanceSession.MORNING,
                    status=status,
                    marked_at=datetime.combine(day, time(6, 45)),
                    marked_by_id=admin.id,
                    remarks="Auto-generated seed data"
                    if status != AttendanceStatus.PRESENT
                    else None,
                )
            )
            count += 1
    _log(f"attendance records: {count}")


def _seed_school_attendance(admin, students):
    today = date.today()
    count = 0
    for student in students.values():
        for offset in range(13, -1, -1):
            day = today - timedelta(days=offset)
            exists = SchoolAttendance.query.filter_by(student_id=student.id, date=day).first()
            if exists:
                continue
            if day.weekday() == 6:
                status = SchoolAttendanceStatus.SCHOOL_HOLIDAY
                departure = expected = actual = None
            elif random.random() < 0.1:
                status = SchoolAttendanceStatus.DID_NOT_GO
                departure = expected = actual = None
            else:
                status = (
                    SchoolAttendanceStatus.RETURNED_FROM_SCHOOL
                    if offset > 0
                    else SchoolAttendanceStatus.WENT_TO_SCHOOL
                )
                departure = time(7, 30)
                expected = time(14, 0)
                actual = time(14, 15) if offset > 0 else None
            db.session.add(
                SchoolAttendance(
                    student_id=student.id,
                    date=day,
                    status=status,
                    departure_time=departure,
                    expected_return_time=expected,
                    actual_return_time=actual,
                    recorded_by_id=admin.id,
                )
            )
            count += 1
    _log(f"school attendance records: {count}")


def _seed_activities(admin, students):
    today = date.today()
    count = 0
    for student in students.values():
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            existing = DailyActivity.query.filter_by(student_id=student.id, date=day).count()
            if existing:
                continue
            now_cut = datetime.now().time()
            for activity_type, title, scheduled in ROUTINE:
                completed = offset > 0 or scheduled <= now_cut
                db.session.add(
                    DailyActivity(
                        student_id=student.id,
                        date=day,
                        activity_type=activity_type,
                        title=title,
                        scheduled_time=scheduled,
                        activity_time=scheduled if completed else None,
                        is_completed=completed,
                        recorded_by_id=admin.id,
                    )
                )
                count += 1
    _log(f"daily activities: {count}")


def _seed_health(admin, students):
    today = date.today()
    count = 0
    scenarios = [
        {
            "status": HealthStatus.FEELING_UNWELL,
            "severity": HealthSeverity.LOW,
            "symptoms": "Mild headache and tiredness after school",
            "temperature": 37.4,
            "medicine": "Paracetamol 250mg",
            "recovery": RecoveryStatus.RECOVERED,
            "offset": 9,
        },
        {
            "status": HealthStatus.SICK,
            "severity": HealthSeverity.MEDIUM,
            "symptoms": "Sore throat, cough, low fever",
            "temperature": 38.2,
            "medicine": "Cough syrup, warm saline gargle",
            "recovery": RecoveryStatus.RECOVERING,
            "offset": 2,
        },
        {
            "status": HealthStatus.MEDICAL_OBSERVATION,
            "severity": HealthSeverity.HIGH,
            "symptoms": "Stomach pain, low appetite. Kept in sick bay for observation.",
            "temperature": 37.9,
            "medicine": "ORS, antacid",
            "recovery": RecoveryStatus.ONGOING,
            "offset": 1,
        },
    ]
    student_list = list(students.values())
    for index, scenario in enumerate(scenarios):
        student = student_list[index % len(student_list)]
        recorded_at = datetime.combine(
            today - timedelta(days=scenario["offset"]), time(18, 30)
        )
        exists = HealthRecord.query.filter_by(
            student_id=student.id, recorded_at=recorded_at
        ).first()
        if exists:
            continue
        db.session.add(
            HealthRecord(
                student_id=student.id,
                status=scenario["status"],
                severity=scenario["severity"],
                symptoms=scenario["symptoms"],
                temperature=scenario["temperature"],
                description="Recorded by the hostel warden during evening rounds.",
                medicine_given=scenario["medicine"],
                doctor_visited=scenario["severity"] != HealthSeverity.LOW,
                doctor_name="Dr. S. Mishra" if scenario["severity"] != HealthSeverity.LOW else None,
                hospital_visit=scenario["severity"] == HealthSeverity.HIGH,
                hospital_name="City Care Clinic"
                if scenario["severity"] == HealthSeverity.HIGH
                else None,
                medical_remarks="Parents informed. Under regular monitoring.",
                recovery_status=scenario["recovery"],
                recovered_at=recorded_at + timedelta(days=2)
                if scenario["recovery"] == RecoveryStatus.RECOVERED
                else None,
                recorded_at=recorded_at,
                recorded_by_id=admin.id,
            )
        )
        count += 1
    _log(f"health records: {count}")


def _seed_meals(admin):
    today = date.today()
    count = 0
    for offset in range(4, -1, -1):
        day = today - timedelta(days=offset)
        for meal_type, (served_at, items) in MEAL_PLAN.items():
            exists = Meal.query.filter_by(date=day, meal_type=meal_type).first()
            if exists:
                continue
            db.session.add(
                Meal(
                    date=day,
                    meal_type=meal_type,
                    name=meal_type.value.replace("_", " ").title(),
                    food_items="\n".join(items),
                    served_at=served_at,
                    remarks="Seasonal vegetables used." if meal_type == MealType.LUNCH else None,
                    created_by_id=admin.id,
                )
            )
            count += 1
    _log(f"meal records: {count} (photos can be uploaded from the admin UI)")


def _seed_progress(admin, students):
    progress_service.ensure_default_categories()
    categories = ProgressCategory.query.all()
    today = date.today()
    academic_count = 0
    progress_count = 0

    for student in students.values():
        for month_offset in range(2, -1, -1):
            month = today.month - month_offset
            year = today.year
            while month <= 0:
                month += 12
                year -= 1
            for category in categories:
                exists = ProgressRecord.query.filter_by(
                    student_id=student.id,
                    category_id=category.id,
                    period_year=year,
                    period_month=month,
                ).first()
                if exists:
                    continue
                base = random.randint(68, 95)
                db.session.add(
                    ProgressRecord(
                        student_id=student.id,
                        category_id=category.id,
                        score=base,
                        period_year=year,
                        period_month=month,
                        remarks="Steady improvement" if base > 85 else None,
                        recorded_by_id=admin.id,
                    )
                )
                progress_count += 1

        for subject in SUBJECTS:
            for exam_name, max_marks in (("Monthly Test", 50), ("Half Yearly", 100)):
                exists = AcademicProgress.query.filter_by(
                    student_id=student.id, subject=subject, exam_name=exam_name
                ).first()
                if exists:
                    continue
                obtained = round(random.uniform(0.6, 0.97) * max_marks)
                record = AcademicProgress(
                    student_id=student.id,
                    subject=subject,
                    exam_name=exam_name,
                    exam_type="Written",
                    marks_obtained=obtained,
                    max_marks=max_marks,
                    teacher_remark=random.choice(
                        [
                            "Good performance",
                            "Needs more practice",
                            "Excellent improvement",
                            "Consistent effort",
                        ]
                    ),
                    exam_date=today - timedelta(days=random.randint(10, 80)),
                    recorded_by_id=admin.id,
                )
                record.recalculate()
                db.session.add(record)
                academic_count += 1
    _log(f"progress scores: {progress_count}, academic results: {academic_count}")


def _seed_communication(admin, students):
    if Announcement.query.count() == 0:
        db.session.add_all(
            [
                Announcement(
                    title="Parent-Teacher meeting on Saturday",
                    description=(
                        "The monthly parent-teacher meeting will be held this Saturday at "
                        "10:00 AM in the hostel common hall. Attendance is encouraged."
                    ),
                    audience=AnnouncementAudience.ALL_PARENTS,
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=10),
                    created_by_id=admin.id,
                ),
                Announcement(
                    title="Night study timing update",
                    description=(
                        "From Monday, night study will run from 9:00 PM to 10:00 PM. "
                        "Lights out remains at 10:00 PM."
                    ),
                    audience=AnnouncementAudience.EVERYONE,
                    start_date=date.today() - timedelta(days=2),
                    created_by_id=admin.id,
                ),
            ]
        )
        _log("announcements: 2")

    verified_parent = (
        Parent.query.filter(Parent.verification_status == VerificationStatus.VERIFIED)
        .order_by(Parent.id)
        .first()
    )
    if verified_parent and Suggestion.query.count() == 0:
        child = verified_parent.children[0] if verified_parent.children else None
        suggestion = Suggestion(
            parent_id=verified_parent.id,
            created_by_id=verified_parent.user_id,
            student_id=child.id if child else None,
            subject="Request for more fruit in breakfast",
            category=SuggestionCategory.FOOD,
            message=(
                "Could the hostel please add a seasonal fruit to the breakfast menu "
                "at least three days a week? Thank you."
            ),
            status=SuggestionStatus.UNDER_REVIEW,
        )
        db.session.add(suggestion)
        db.session.flush()
        db.session.add(
            SuggestionReply(
                suggestion_id=suggestion.id,
                author_id=admin.id,
                message="Thank you for the suggestion. We are reviewing it with the kitchen team.",
            )
        )
        _log("suggestions: 1 (with reply)")

    if Notification.query.count() == 0:
        for parent in Parent.query.filter(
            Parent.verification_status == VerificationStatus.VERIFIED
        ).all():
            child = parent.children[0] if parent.children else None
            db.session.add(
                Notification(
                    user_id=parent.user_id,
                    student_id=child.id if child else None,
                    type=NotificationType.ACCOUNT_VERIFICATION,
                    priority=NotificationPriority.NORMAL,
                    title="Account verified",
                    message="Your account has been verified. You can now view your child's records.",
                    link="/parent/dashboard",
                    created_by_id=admin.id,
                )
            )
            if child:
                db.session.add(
                    Notification(
                        user_id=parent.user_id,
                        student_id=child.id,
                        type=NotificationType.MEAL_UPDATE,
                        priority=NotificationPriority.LOW,
                        title="Today's lunch photos",
                        message="Photos of today's lunch have been added by the warden.",
                        link="/parent/children/%d/meals" % child.id,
                        created_by_id=admin.id,
                    )
                )
        _log("notifications seeded")


def run_seed(reset=False):
    app = create_app()
    with app.app_context():
        if reset:
            print("Dropping all tables...")
            db.drop_all()
        db.create_all()

        print("Seeding data:")
        admin = _create_admin()
        db.session.flush()
        rooms = _create_rooms()
        students = _create_students(admin, rooms)
        _create_parents(admin, students)
        _seed_attendance(admin, students)
        _seed_school_attendance(admin, students)
        _seed_activities(admin, students)
        _seed_health(admin, students)
        _seed_meals(admin)
        _seed_progress(admin, students)
        _seed_communication(admin, students)
        db.session.commit()

        print("\nSeed complete. Demo accounts (password for all: %s)" % DEMO_PASSWORD)
        print(f"  ADMIN   {ADMIN['email']}")
        for spec in PARENTS:
            label = "verified" if spec["verification"] == VerificationStatus.VERIFIED else "pending"
            print(f"  PARENT  {spec['email']}  ({label})")
        for spec in STUDENTS:
            if spec["login"]:
                print(f"  STUDENT {spec['login']}")


if __name__ == "__main__":
    run_seed(reset="--reset" in sys.argv)
