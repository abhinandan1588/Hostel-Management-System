"""Authorization and privacy boundaries.

These are the tests that matter most: they prove the backend never trusts the
client about identity, role or resource ownership.
"""

import pytest

from app.constants import AccountStatus, VerificationStatus
from app.extensions import db

from .conftest import auth, login


class TestParentCannotReachAnotherFamily:
    """A parent must never read another parent's child by editing the URL."""

    @pytest.mark.parametrize(
        "url_template",
        [
            "/api/students/{other}",
            "/api/students/{other}/overview",
            "/api/students/{other}/status-history",
            "/api/attendance/{other}",
            "/api/attendance/{other}/summary",
            "/api/attendance/{other}/calendar",
            "/api/health/{other}",
            "/api/health/{other}/current",
            "/api/school-attendance/student/{other}",
            "/api/activities/{other}",
            "/api/progress/student/{other}",
            "/api/progress/student/{other}/current",
            "/api/parent/children/{other}",
            "/api/parent/children/{other}/attendance",
            "/api/parent/children/{other}/health",
            "/api/parent/children/{other}/progress",
            "/api/parent/children/{other}/daily-activity",
        ],
    )
    def test_denied(self, client, world, parent_a_token, url_template):
        other = world["student_c"].id
        url = url_template.format(other=other)
        response = client.get(url, headers=auth(parent_a_token))
        assert response.status_code in (403, 404), f"{url} -> {response.status_code}"

    def test_own_child_is_allowed(self, client, world, parent_a_token):
        own = world["student_a"].id
        assert (
            client.get(f"/api/students/{own}", headers=auth(parent_a_token)).status_code == 200
        )

    def test_list_endpoints_are_scoped_to_own_children(self, client, world, parent_a_token):
        response = client.get("/api/students", headers=auth(parent_a_token))
        assert response.status_code == 200
        returned = {row["id"] for row in response.get_json()["data"]}
        assert returned == {world["student_a"].id, world["student_b"].id}

    def test_filtering_by_another_students_id_is_denied(self, client, world, parent_a_token):
        response = client.get(
            f"/api/attendance?student_id={world['student_c'].id}",
            headers=auth(parent_a_token),
        )
        assert response.status_code in (403, 404)

    def test_parent_cannot_read_another_parent_profile(self, client, world, parent_a_token):
        response = client.get(
            f"/api/parents/{world['parent_b'].id}", headers=auth(parent_a_token)
        )
        assert response.status_code == 403


class TestStudentScope:
    def test_student_cannot_read_another_student(self, client, world, student_a_token):
        response = client.get(
            f"/api/students/{world['student_c'].id}", headers=auth(student_a_token)
        )
        assert response.status_code == 403

    def test_student_list_is_only_themselves(self, client, world, student_a_token):
        response = client.get("/api/students", headers=auth(student_a_token))
        assert response.status_code == 200
        returned = {row["id"] for row in response.get_json()["data"]}
        assert returned == {world["student_a"].id}

    def test_student_can_read_own_records(self, client, world, student_a_token):
        for url in (
            "/api/student/dashboard",
            "/api/student/attendance",
            "/api/student/health",
            "/api/student/progress",
            "/api/student/routine",
        ):
            assert client.get(url, headers=auth(student_a_token)).status_code == 200

    def test_student_cannot_use_parent_portal(self, client, student_a_token):
        response = client.get("/api/parent/dashboard", headers=auth(student_a_token))
        assert response.status_code == 403

    def test_parent_cannot_use_student_portal(self, client, parent_a_token):
        response = client.get("/api/student/dashboard", headers=auth(parent_a_token))
        assert response.status_code == 403


class TestOfficialRecordsAreAdminOnly:
    """Students and parents must never be able to write official records."""

    WRITES = [
        ("post", "/api/attendance", {"student_id": 1, "status": "present"}),
        ("post", "/api/attendance/bulk", {"records": [{"student_id": 1, "status": "absent"}]}),
        ("post", "/api/health", {"student_id": 1, "status": "sick", "symptoms": "test"}),
        ("post", "/api/school-attendance", {"student_id": 1, "status": "went_to_school"}),
        ("post", "/api/activities", {"student_id": 1, "activity_type": "study"}),
        (
            "post",
            "/api/progress/academic",
            {
                "student_id": 1,
                "subject": "Maths",
                "exam_name": "Test",
                "marks_obtained": 10,
                "max_marks": 10,
            },
        ),
        ("post", "/api/progress", {"student_id": 1, "category_slug": "academic", "score": 100}),
        ("post", "/api/meals", {"meal_type": "lunch"}),
        ("post", "/api/rooms", {"room_number": "999"}),
        ("post", "/api/announcements", {"title": "x", "description": "y", "audience": "all_parents"}),
        (
            "post",
            "/api/emergency-alerts",
            {"alert_type": "medical_emergency", "audience": "all_parents", "title": "x", "message": "y"},
        ),
    ]

    @pytest.mark.parametrize("method,url,payload", WRITES)
    def test_student_cannot_write(self, client, world, student_a_token, method, url, payload):
        body = dict(payload)
        if "student_id" in body:
            body["student_id"] = world["student_a"].id
        response = getattr(client, method)(url, headers=auth(student_a_token), json=body)
        assert response.status_code == 403, f"{url} -> {response.status_code}"

    @pytest.mark.parametrize("method,url,payload", WRITES)
    def test_parent_cannot_write(self, client, world, parent_a_token, method, url, payload):
        body = dict(payload)
        if "student_id" in body:
            body["student_id"] = world["student_a"].id
        response = getattr(client, method)(url, headers=auth(parent_a_token), json=body)
        assert response.status_code == 403, f"{url} -> {response.status_code}"

    def test_student_cannot_modify_attendance_record(self, client, world, admin_token, student_a_token):
        created = client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        record_id = created.get_json()["data"]["id"]
        response = client.patch(
            f"/api/attendance/{record_id}",
            headers=auth(student_a_token),
            json={"status": "absent"},
        )
        assert response.status_code == 403

    def test_student_cannot_delete_own_attendance(self, client, world, admin_token, student_a_token):
        created = client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "absent"},
        )
        record_id = created.get_json()["data"]["id"]
        response = client.delete(
            f"/api/attendance/{record_id}", headers=auth(student_a_token)
        )
        assert response.status_code == 403

    def test_student_may_only_edit_whitelisted_profile_fields(
        self, client, world, student_a_token
    ):
        response = client.patch(
            "/api/student/profile",
            headers=auth(student_a_token),
            json={
                "phone": "+919900112233",
                "student_class": "Class 12",
                "student_code": "HACKED",
                "verification_status": "VERIFIED",
            },
        )
        assert response.status_code == 200
        db.session.refresh(world["student_a"])
        assert world["student_a"].phone == "+919900112233"
        # Official fields were silently ignored, not applied.
        assert world["student_a"].student_class == "Class 8"
        assert world["student_a"].student_code == "HMS0001"

    def test_student_can_confirm_own_activity_only(
        self, client, world, admin_token, student_a_token
    ):
        own = client.post(
            "/api/activities",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "activity_type": "breakfast"},
        ).get_json()["data"]["id"]
        other = client.post(
            "/api/activities",
            headers=auth(admin_token),
            json={"student_id": world["student_c"].id, "activity_type": "breakfast"},
        ).get_json()["data"]["id"]

        assert (
            client.post(
                f"/api/activities/{own}/confirm", headers=auth(student_a_token)
            ).status_code
            == 200
        )
        assert (
            client.post(
                f"/api/activities/{other}/confirm", headers=auth(student_a_token)
            ).status_code
            == 403
        )


class TestUnverifiedParent:
    """A pending parent must not receive any child information."""

    @pytest.mark.parametrize(
        "url",
        [
            "/api/parent/dashboard",
            "/api/parent/children",
        ],
    )
    def test_portal_is_locked(self, client, pending_parent_token, url):
        assert client.get(url, headers=auth(pending_parent_token)).status_code == 403

    def test_cannot_read_the_claimed_child(self, client, world, pending_parent_token):
        response = client.get(
            f"/api/students/{world['student_c'].id}", headers=auth(pending_parent_token)
        )
        assert response.status_code == 403

    def test_student_list_is_empty(self, client, pending_parent_token):
        response = client.get("/api/students", headers=auth(pending_parent_token))
        assert response.status_code == 200
        assert response.get_json()["data"] == []

    def test_cannot_send_suggestions(self, client, pending_parent_token):
        response = client.post(
            "/api/suggestions",
            headers=auth(pending_parent_token),
            json={"subject": "Hello there", "category": "food", "message": "Please improve"},
        )
        assert response.status_code == 403

    def test_status_endpoint_is_reachable(self, client, pending_parent_token):
        response = client.get("/api/parent/status", headers=auth(pending_parent_token))
        assert response.status_code == 200
        assert response.get_json()["data"]["verification_status"] == "PENDING"

    def test_access_opens_after_admin_verification(
        self, client, world, admin_token, pending_parent_token
    ):
        parent = world["pending_parent"]
        assert (
            client.get("/api/parent/dashboard", headers=auth(pending_parent_token)).status_code
            == 403
        )
        client.post(f"/api/parents/{parent.id}/verify", headers=auth(admin_token))
        assert (
            client.get("/api/parent/dashboard", headers=auth(pending_parent_token)).status_code
            == 200
        )


class TestBlockedAccounts:
    def test_blocked_token_stops_working_immediately(self, client, world, parent_a_token):
        assert client.get("/api/auth/me", headers=auth(parent_a_token)).status_code == 200
        world["parent_a"].user.account_status = AccountStatus.BLOCKED
        db.session.commit()
        # Existing tokens are re-checked against account state on every request.
        assert client.get("/api/auth/me", headers=auth(parent_a_token)).status_code == 403

    def test_rejected_parent_loses_child_access(self, client, world, parent_a_token):
        world["parent_a"].verification_status = VerificationStatus.REJECTED
        db.session.commit()
        response = client.get(
            f"/api/students/{world['student_a'].id}", headers=auth(parent_a_token)
        )
        assert response.status_code == 403


class TestAdminOnlyAreas:
    ADMIN_URLS = [
        "/api/admin/dashboard",
        "/api/admin/summary",
        "/api/admin/settings",
        "/api/admin/audit-logs",
        "/api/admin/admins",
        "/api/admin/search?q=test",
        "/api/parents",
        "/api/rooms",
        "/api/rooms/tree",
        "/api/beds",
        "/api/attendance/sheet",
        "/api/attendance/today",
        "/api/health/overview",
        "/api/school-attendance/sheet",
        "/api/activities/stats",
        "/api/reports",
        "/api/reports/student-list",
        "/api/students/filter-options",
    ]

    @pytest.mark.parametrize("url", ADMIN_URLS)
    def test_parent_denied(self, client, parent_a_token, url):
        assert client.get(url, headers=auth(parent_a_token)).status_code == 403

    @pytest.mark.parametrize("url", ADMIN_URLS)
    def test_student_denied(self, client, student_a_token, url):
        assert client.get(url, headers=auth(student_a_token)).status_code == 403

    @pytest.mark.parametrize("url", ADMIN_URLS)
    def test_anonymous_denied(self, client, world, url):
        assert client.get(url).status_code == 401


class TestSuggestionPrivacy:
    def test_parent_only_sees_own_suggestions(
        self, client, world, parent_a_token, parent_b_token
    ):
        client.post(
            "/api/suggestions",
            headers=auth(parent_a_token),
            json={"subject": "From parent A", "category": "food", "message": "Message body"},
        )
        response = client.get("/api/suggestions", headers=auth(parent_b_token))
        assert response.status_code == 200
        assert response.get_json()["data"] == []

    def test_parent_cannot_open_another_parents_suggestion(
        self, client, world, parent_a_token, parent_b_token
    ):
        created = client.post(
            "/api/suggestions",
            headers=auth(parent_a_token),
            json={"subject": "Private note", "category": "health", "message": "Message body"},
        ).get_json()["data"]["id"]
        response = client.get(f"/api/suggestions/{created}", headers=auth(parent_b_token))
        assert response.status_code == 403

    def test_parent_cannot_change_suggestion_status(self, client, parent_a_token):
        created = client.post(
            "/api/suggestions",
            headers=auth(parent_a_token),
            json={"subject": "Status test", "category": "room", "message": "Message body"},
        ).get_json()["data"]["id"]
        response = client.patch(
            f"/api/suggestions/{created}/status",
            headers=auth(parent_a_token),
            json={"status": "resolved"},
        )
        assert response.status_code == 403


class TestNotificationPrivacy:
    def test_cannot_read_another_users_notification(
        self, client, world, admin_token, parent_a_token, parent_b_token
    ):
        # A health record notifies parent_a only.
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick", "symptoms": "fever"},
        )
        inbox_a = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()
        inbox_b = client.get("/api/notifications", headers=auth(parent_b_token)).get_json()
        assert len(inbox_a["data"]) >= 1
        assert inbox_b["data"] == []

        notification_id = inbox_a["data"][0]["id"]
        response = client.post(
            f"/api/notifications/{notification_id}/read", headers=auth(parent_b_token)
        )
        assert response.status_code == 404


class TestMediaPathTraversal:
    def test_traversal_is_refused(self, client, admin_token):
        response = client.get("/api/media/../.env")
        assert response.status_code in (400, 404)


class TestTokenRoleCannotBeForged:
    def test_role_claim_is_not_trusted(self, client, world):
        """A token whose claims say ADMIN is still checked against the database."""
        from flask_jwt_extended import create_access_token

        forged = create_access_token(
            identity=str(world["parent_a"].user_id),
            additional_claims={"role": "ADMIN", "is_super_admin": True},
        )
        response = client.get("/api/admin/dashboard", headers=auth(forged))
        assert response.status_code == 403
