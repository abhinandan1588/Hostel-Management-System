"""Student, parent and hostel room management."""

from app.constants import AccountStatus, VerificationStatus
from app.extensions import db
from app.models import AuditLog, Student

from .conftest import PASSWORD, auth, login

NEW_STUDENT = {
    "full_name": "Fresh Student",
    "student_class": "Class 5",
    "school_name": "New Public School",
    "date_of_birth": "2014-03-10",
    "gender": "MALE",
    "admission_date": "2026-01-15",
    "emergency_contact_name": "Uncle",
    "emergency_contact_phone": "+919812300000",
    "emergency_contact_relation": "Guardian",
}


class TestStudentCreation:
    def test_admin_can_create_student_with_generated_code(self, client, admin_token):
        response = client.post("/api/students", headers=auth(admin_token), json=NEW_STUDENT)
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert data["student_code"].startswith("HMS")
        assert data["full_name"] == "Fresh Student"

    def test_duplicate_student_code_is_rejected(self, client, admin_token):
        payload = {**NEW_STUDENT, "student_code": "DUP001"}
        assert client.post("/api/students", headers=auth(admin_token), json=payload).status_code == 201
        assert client.post("/api/students", headers=auth(admin_token), json=payload).status_code == 409

    def test_validation_errors_are_field_level(self, client, admin_token):
        response = client.post("/api/students", headers=auth(admin_token), json={"full_name": "X"})
        assert response.status_code == 422
        errors = response.get_json()["errors"]
        assert "student_class" in errors and "school_name" in errors

    def test_create_with_login_account(self, client, admin_token):
        payload = {
            **NEW_STUDENT,
            "student_code": "LOGIN01",
            "create_account": True,
            "account_email": "fresh.student@test.local",
            "account_password": PASSWORD,
        }
        response = client.post("/api/students", headers=auth(admin_token), json=payload)
        assert response.status_code == 201
        assert response.get_json()["data"]["has_login"] is True
        assert login(client, "fresh.student@test.local")

    def test_create_account_requires_password(self, client, admin_token):
        payload = {**NEW_STUDENT, "student_code": "NOPASS", "create_account": True, "account_email": "a@b.co"}
        response = client.post("/api/students", headers=auth(admin_token), json=payload)
        assert response.status_code == 422

    def test_creation_writes_an_audit_log(self, client, admin_token):
        client.post("/api/students", headers=auth(admin_token), json=NEW_STUDENT)
        entry = AuditLog.query.filter_by(action="STUDENT_CREATED").first()
        assert entry is not None
        assert entry.admin_name is not None


class TestStudentUpdates:
    def test_admin_can_update_student(self, client, world, admin_token):
        response = client.patch(
            f"/api/students/{world['student_a'].id}",
            headers=auth(admin_token),
            json={"student_class": "Class 9", "phone": "+919845000111"},
        )
        assert response.status_code == 200
        assert response.get_json()["data"]["student_class"] == "Class 9"

    def test_verify_student(self, client, world, admin_token):
        world["student_b"].verification_status = VerificationStatus.PENDING
        db.session.commit()
        response = client.post(
            f"/api/students/{world['student_b'].id}/verify", headers=auth(admin_token)
        )
        assert response.status_code == 200
        assert response.get_json()["data"]["verification_status"] == "VERIFIED"

    def test_block_and_unblock_student_login(self, client, world, admin_token):
        student = world["student_a"]
        client.post(f"/api/students/{student.id}/block", headers=auth(admin_token), json={"reason": "Rules"})
        db.session.refresh(student.user)
        assert student.user.account_status == AccountStatus.BLOCKED
        # A blocked student can no longer authenticate.
        assert client.post(
            "/api/auth/login", json={"identifier": "student.a@test.local", "password": PASSWORD}
        ).status_code == 403

        client.post(f"/api/students/{student.id}/unblock", headers=auth(admin_token))
        db.session.refresh(student.user)
        assert student.user.account_status == AccountStatus.ACTIVE

    def test_delete_is_a_soft_delete(self, client, world, admin_token):
        student_id = world["student_b"].id
        response = client.delete(f"/api/students/{student_id}", headers=auth(admin_token))
        assert response.status_code == 200
        archived = db.session.get(Student, student_id)
        assert archived is not None  # record preserved
        assert archived.is_active is False
        assert archived.bed_id is None  # bed released

    def test_archived_student_is_hidden_from_default_list(self, client, world, admin_token):
        client.delete(f"/api/students/{world['student_b'].id}", headers=auth(admin_token))
        response = client.get("/api/students", headers=auth(admin_token))
        ids = {row["id"] for row in response.get_json()["data"]}
        assert world["student_b"].id not in ids

    def test_restore_student(self, client, world, admin_token):
        student_id = world["student_b"].id
        client.delete(f"/api/students/{student_id}", headers=auth(admin_token))
        response = client.post(f"/api/students/{student_id}/restore", headers=auth(admin_token))
        assert response.status_code == 200
        assert db.session.get(Student, student_id).is_active is True


class TestStudentSearchAndFilters:
    def test_search_by_name(self, client, admin_token):
        response = client.get("/api/students?q=Student%20C", headers=auth(admin_token))
        assert response.status_code == 200
        assert [row["full_name"] for row in response.get_json()["data"]] == ["Student C"]

    def test_search_by_student_code(self, client, admin_token):
        response = client.get("/api/students?q=HMS0002", headers=auth(admin_token))
        assert [row["student_code"] for row in response.get_json()["data"]] == ["HMS0002"]

    def test_search_by_parent_name(self, client, world, admin_token):
        response = client.get("/api/students?q=parent.b", headers=auth(admin_token))
        ids = {row["id"] for row in response.get_json()["data"]}
        assert ids == {world["student_c"].id}

    def test_search_by_room_number(self, client, admin_token):
        response = client.get("/api/students?q=101", headers=auth(admin_token))
        assert len(response.get_json()["data"]) == 3

    def test_filter_by_class(self, client, admin_token):
        response = client.get("/api/students?student_class=Class%208", headers=auth(admin_token))
        assert len(response.get_json()["data"]) == 3

    def test_filter_by_health_status(self, client, world, admin_token):
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick", "symptoms": "fever"},
        )
        response = client.get("/api/students?health=SICK", headers=auth(admin_token))
        ids = {row["id"] for row in response.get_json()["data"]}
        assert ids == {world["student_a"].id}

    def test_filter_by_attendance_not_marked(self, client, world, admin_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        response = client.get("/api/students?attendance=NOT_MARKED", headers=auth(admin_token))
        ids = {row["id"] for row in response.get_json()["data"]}
        assert world["student_a"].id not in ids
        assert world["student_c"].id in ids

    def test_pagination_metadata(self, client, admin_token):
        response = client.get("/api/students?per_page=2&page=1", headers=auth(admin_token))
        meta = response.get_json()["meta"]
        assert meta["per_page"] == 2 and meta["total"] == 3 and meta["has_next"] is True

    def test_filter_options(self, client, admin_token):
        response = client.get("/api/students/filter-options", headers=auth(admin_token))
        data = response.get_json()["data"]
        assert "Class 8" in data["classes"]
        assert data["rooms"]


class TestParentVerificationWorkflow:
    def test_verify_activates_account_and_notifies(self, client, world, admin_token):
        parent = world["pending_parent"]
        response = client.post(f"/api/parents/{parent.id}/verify", headers=auth(admin_token))
        assert response.status_code == 200
        db.session.refresh(parent)
        assert parent.verification_status == VerificationStatus.VERIFIED
        assert parent.user.account_status == AccountStatus.ACTIVE

        token = login(client, parent.user.email)
        inbox = client.get("/api/notifications", headers=auth(token)).get_json()["data"]
        assert any(item["type"] == "ACCOUNT_VERIFICATION" for item in inbox)

    def test_reject_blocks_access_and_records_reason(self, client, world, admin_token):
        parent = world["pending_parent"]
        response = client.post(
            f"/api/parents/{parent.id}/reject",
            headers=auth(admin_token),
            json={"reason": "Could not confirm relationship"},
        )
        assert response.status_code == 200
        db.session.refresh(parent)
        assert parent.verification_status == VerificationStatus.REJECTED
        assert parent.rejection_reason == "Could not confirm relationship"
        assert client.post(
            "/api/auth/login",
            json={"identifier": parent.user.email, "password": PASSWORD},
        ).status_code == 403

    def test_review_payload_includes_claimed_student(self, client, world, admin_token):
        response = client.get(
            f"/api/parents/{world['pending_parent'].id}/review", headers=auth(admin_token)
        )
        assert response.status_code == 200
        data = response.get_json()["data"]
        assert data["claimed_student"]["student_code"] == "HMS0003"

    def test_block_and_unblock_parent(self, client, world, admin_token):
        parent = world["parent_a"]
        client.post(f"/api/parents/{parent.id}/block", headers=auth(admin_token), json={})
        db.session.refresh(parent.user)
        assert parent.user.account_status == AccountStatus.BLOCKED
        client.post(f"/api/parents/{parent.id}/unblock", headers=auth(admin_token))
        db.session.refresh(parent.user)
        assert parent.user.account_status == AccountStatus.ACTIVE

    def test_remove_parent_unlinks_children(self, client, world, admin_token):
        parent = world["parent_a"]
        response = client.delete(f"/api/parents/{parent.id}", headers=auth(admin_token))
        assert response.status_code == 200
        db.session.refresh(parent)
        assert parent.student_links == []
        assert parent.user.account_status == AccountStatus.INACTIVE

    def test_pending_count_in_list_meta(self, client, admin_token):
        response = client.get("/api/parents", headers=auth(admin_token))
        assert response.get_json()["meta"]["pending_verification"] == 1

    def test_filter_parents_by_verification_status(self, client, admin_token):
        response = client.get("/api/parents?verification_status=PENDING", headers=auth(admin_token))
        rows = response.get_json()["data"]
        assert len(rows) == 1 and rows[0]["verification_status"] == "PENDING"


class TestParentStudentLinking:
    def test_admin_can_link_and_unlink_parent(self, client, world, admin_token):
        student = world["student_c"]
        parent = world["parent_a"]
        response = client.post(
            f"/api/students/{student.id}/parents",
            headers=auth(admin_token),
            json={"parent_id": parent.id, "relationship_type": "Aunt"},
        )
        assert response.status_code == 200
        assert any(p["parent_id"] == parent.id for p in response.get_json()["data"]["parents"])

        # Linking again is a conflict.
        assert client.post(
            f"/api/students/{student.id}/parents",
            headers=auth(admin_token),
            json={"parent_id": parent.id},
        ).status_code == 409

        assert client.delete(
            f"/api/students/{student.id}/parents/{parent.id}", headers=auth(admin_token)
        ).status_code == 200

    def test_newly_linked_parent_gains_access(self, client, world, admin_token, parent_a_token):
        student = world["student_c"]
        assert client.get(f"/api/students/{student.id}", headers=auth(parent_a_token)).status_code == 403
        client.post(
            f"/api/students/{student.id}/parents",
            headers=auth(admin_token),
            json={"parent_id": world["parent_a"].id},
        )
        assert client.get(f"/api/students/{student.id}", headers=auth(parent_a_token)).status_code == 200


class TestRoomsAndBeds:
    def test_create_room_generates_beds(self, client, admin_token):
        response = client.post(
            "/api/rooms",
            headers=auth(admin_token),
            json={"building": "Building B", "floor": 2, "room_number": "201", "capacity": 4},
        )
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert len(data["beds"]) == 4 and data["available_beds"] == 4

    def test_duplicate_room_number_rejected(self, client, admin_token):
        payload = {"building": "Building A", "room_number": "101", "capacity": 2}
        assert client.post("/api/rooms", headers=auth(admin_token), json=payload).status_code == 409

    def test_occupancy_summary(self, client, world, admin_token):
        response = client.get("/api/rooms/summary", headers=auth(admin_token))
        summary = response.get_json()["data"]["summary"]
        assert summary["total_beds"] == 3
        assert summary["occupied_beds"] == 3
        assert summary["available_beds"] == 0

    def test_room_tree_structure(self, client, admin_token):
        response = client.get("/api/rooms/tree", headers=auth(admin_token))
        buildings = response.get_json()["data"]["buildings"]
        assert buildings[0]["building"] == "Building A"
        assert buildings[0]["floors"][0]["rooms"][0]["room_number"] == "101"

    def test_cannot_delete_occupied_room(self, client, world, admin_token):
        response = client.delete(f"/api/rooms/{world['room'].id}", headers=auth(admin_token))
        assert response.status_code == 400
        assert "student" in response.get_json()["message"].lower()

    def test_bed_reassignment_conflict(self, client, world, admin_token):
        occupied_bed = world["room"].beds[0].id
        response = client.put(
            f"/api/students/{world['student_c'].id}/bed",
            headers=auth(admin_token),
            json={"bed_id": occupied_bed},
        )
        assert response.status_code == 409

    def test_release_and_reassign_bed(self, client, world, admin_token):
        student = world["student_a"]
        bed_id = student.bed_id
        assert client.put(
            f"/api/students/{student.id}/bed", headers=auth(admin_token), json={"bed_id": None}
        ).status_code == 200
        assert client.put(
            f"/api/students/{student.id}/bed", headers=auth(admin_token), json={"bed_id": bed_id}
        ).status_code == 200

    def test_available_beds_endpoint(self, client, world, admin_token):
        client.put(
            f"/api/students/{world['student_a'].id}/bed",
            headers=auth(admin_token),
            json={"bed_id": None},
        )
        response = client.get("/api/beds?available_only=true", headers=auth(admin_token))
        assert len(response.get_json()["data"]) == 1


class TestStudentStatus:
    def test_status_change_records_history_and_notifies(
        self, client, world, admin_token, parent_a_token
    ):
        student = world["student_a"]
        response = client.post(
            f"/api/students/{student.id}/status",
            headers=auth(admin_token),
            json={"status": "outside_with_permission", "remarks": "Dentist appointment"},
        )
        assert response.status_code == 200
        assert response.get_json()["data"]["student"]["current_status"] == "OUTSIDE_WITH_PERMISSION"

        history = client.get(
            f"/api/students/{student.id}/status-history", headers=auth(parent_a_token)
        ).get_json()["data"]
        assert history[0]["status"] == "OUTSIDE_WITH_PERMISSION"
        assert history[0]["remarks"] == "Dentist appointment"

        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert any(item["type"] == "ACTIVITY_UPDATE" for item in inbox)

    def test_unknown_status_is_rejected(self, client, world, admin_token):
        response = client.post(
            f"/api/students/{world['student_a'].id}/status",
            headers=auth(admin_token),
            json={"status": "TELEPORTED"},
        )
        assert response.status_code == 422
