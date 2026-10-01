"""Shared pytest fixtures.

Each test runs against a fresh in-memory SQLite database so tests are isolated
and fast.
"""

import os
import shutil
import sys
from datetime import date, time

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("FLASK_ENV", "testing")

from app import create_app  # noqa: E402
from app.constants import (  # noqa: E402
    AccountStatus,
    Gender,
    UserRole,
    VerificationStatus,
)
from app.extensions import db as _db  # noqa: E402
from app.models import (  # noqa: E402
    AdminProfile,
    Bed,
    Parent,
    Room,
    Student,
    StudentParent,
    User,
)
from app.services import progress_service  # noqa: E402

PASSWORD = "Password123"


@pytest.fixture()
def app():
    application = create_app("testing")
    with application.app_context():
        _db.create_all()
        progress_service.ensure_default_categories()
        yield application
        _db.session.remove()
        _db.drop_all()
    upload_root = application.config["UPLOAD_FOLDER"]
    if os.path.isdir(upload_root):
        shutil.rmtree(upload_root, ignore_errors=True)


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def db(app):
    return _db


# ---------------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------------
def make_user(
    email,
    role,
    password=PASSWORD,
    full_name=None,
    account_status=AccountStatus.ACTIVE,
    is_super_admin=False,
):
    user = User(
        full_name=full_name or email.split("@")[0].replace(".", " ").title(),
        email=email,
        role=role,
        account_status=account_status,
        is_email_verified=True,
        is_super_admin=is_super_admin,
    )
    user.set_password(password)
    _db.session.add(user)
    _db.session.flush()
    return user


def make_admin(email="warden@test.local", is_super_admin=True):
    user = make_user(email, UserRole.ADMIN, is_super_admin=is_super_admin)
    _db.session.add(AdminProfile(user_id=user.id, designation="Warden"))
    _db.session.commit()
    return user


def make_parent(
    email="parent@test.local",
    verification=VerificationStatus.VERIFIED,
    account_status=None,
    claimed_student_code=None,
):
    if account_status is None:
        account_status = (
            AccountStatus.ACTIVE
            if verification == VerificationStatus.VERIFIED
            else AccountStatus.PENDING_VERIFICATION
        )
    user = make_user(email, UserRole.PARENT, account_status=account_status)
    parent = Parent(
        user_id=user.id,
        address="1 Test Street",
        relationship_to_student="Mother",
        verification_status=verification,
        claimed_student_code=claimed_student_code,
    )
    _db.session.add(parent)
    _db.session.commit()
    return parent


def make_room(room_number="101", beds=3, building="Building A"):
    room = Room(building=building, floor=1, room_number=room_number, capacity=beds)
    _db.session.add(room)
    _db.session.flush()
    for index in range(1, beds + 1):
        _db.session.add(Bed(room_id=room.id, bed_number=str(index)))
    _db.session.commit()
    return room


def make_student(
    code="HMS0001",
    name="Test Student",
    student_class="Class 8",
    parent=None,
    with_login=None,
    bed=None,
):
    student = Student(
        student_code=code,
        full_name=name,
        date_of_birth=date(2012, 1, 1),
        gender=Gender.MALE,
        student_class=student_class,
        school_name="Test High School",
        admission_date=date(2025, 6, 1),
        verification_status=VerificationStatus.VERIFIED,
    )
    if bed is not None:
        student.bed_id = bed.id
    _db.session.add(student)
    _db.session.flush()

    if parent is not None:
        _db.session.add(
            StudentParent(
                student_id=student.id,
                parent_id=parent.id,
                relationship_type="Mother",
                is_primary=True,
            )
        )
    if with_login:
        account = make_user(with_login, UserRole.STUDENT, full_name=name)
        student.user_id = account.id
    _db.session.commit()
    return student


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def login(client, email, password=PASSWORD):
    response = client.post(
        "/api/auth/login", json={"identifier": email, "password": password}
    )
    assert response.status_code == 200, response.get_json()
    return response.get_json()["data"]["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def world(app):
    """A small hostel: 1 admin, 2 parents, 3 students, 1 room.

    parent_a -> student_a (+ student_b)
    parent_b -> student_c
    """
    admin = make_admin()
    room = make_room()
    parent_a = make_parent("parent.a@test.local")
    parent_b = make_parent("parent.b@test.local")
    pending_parent = make_parent(
        "parent.pending@test.local",
        verification=VerificationStatus.PENDING,
        claimed_student_code="HMS0003",
    )

    student_a = make_student(
        "HMS0001",
        "Student A",
        parent=parent_a,
        with_login="student.a@test.local",
        bed=room.beds[0],
    )
    student_b = make_student(
        "HMS0002", "Student B", parent=parent_a, bed=room.beds[1]
    )
    student_c = make_student(
        "HMS0003",
        "Student C",
        parent=parent_b,
        with_login="student.c@test.local",
        bed=room.beds[2],
    )
    return {
        "admin": admin,
        "room": room,
        "parent_a": parent_a,
        "parent_b": parent_b,
        "pending_parent": pending_parent,
        "student_a": student_a,
        "student_b": student_b,
        "student_c": student_c,
    }


@pytest.fixture()
def admin_token(client, world):
    return login(client, world["admin"].email)


@pytest.fixture()
def parent_a_token(client, world):
    return login(client, world["parent_a"].user.email)


@pytest.fixture()
def parent_b_token(client, world):
    return login(client, world["parent_b"].user.email)


@pytest.fixture()
def pending_parent_token(client, world):
    return login(client, world["pending_parent"].user.email)


@pytest.fixture()
def student_a_token(client, world):
    return login(client, "student.a@test.local")


@pytest.fixture()
def student_c_token(client, world):
    return login(client, "student.c@test.local")


@pytest.fixture()
def today():
    return date.today()


@pytest.fixture()
def noon():
    return time(12, 0)
