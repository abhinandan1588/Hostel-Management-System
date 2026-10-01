"""Suggestions, notifications, announcements, emergency alerts, reports, audit."""

from app.models import AuditLog

from .conftest import auth, login

SUGGESTION = {
    "subject": "Please add more fruit at breakfast",
    "category": "food",
    "message": "Could the kitchen add a seasonal fruit three days a week?",
}


class TestSuggestions:
    def test_parent_can_send_a_suggestion(self, client, world, parent_a_token):
        response = client.post("/api/suggestions", headers=auth(parent_a_token), json=SUGGESTION)
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert data["status"] == "NEW" and data["category"] == "FOOD"
        assert data["source"] == "PARENT"
        # Auto-attributed to a child when the parent has exactly one match.
        assert data["student_id"] in {world["student_a"].id, world["student_b"].id, None}

    def test_admin_sees_all_suggestions_with_stats(
        self, client, parent_a_token, parent_b_token, admin_token
    ):
        client.post("/api/suggestions", headers=auth(parent_a_token), json=SUGGESTION)
        client.post(
            "/api/suggestions",
            headers=auth(parent_b_token),
            json={**SUGGESTION, "subject": "Study lamp request", "category": "room"},
        )
        response = client.get("/api/suggestions", headers=auth(admin_token))
        body = response.get_json()
        assert len(body["data"]) == 2
        assert body["meta"]["stats"]["NEW"] == 2
        assert body["meta"]["stats"]["OPEN"] == 2

    def test_admin_status_transitions(self, client, parent_a_token, admin_token):
        suggestion_id = client.post(
            "/api/suggestions", headers=auth(parent_a_token), json=SUGGESTION
        ).get_json()["data"]["id"]
        for status in ("under_review", "in_progress", "resolved"):
            response = client.patch(
                f"/api/suggestions/{suggestion_id}/status",
                headers=auth(admin_token),
                json={"status": status},
            )
            assert response.status_code == 200
            assert response.get_json()["data"]["status"] == status.upper()
        assert response.get_json()["data"]["resolved_at"] is not None

    def test_admin_reply_notifies_the_parent(self, client, parent_a_token, admin_token):
        suggestion_id = client.post(
            "/api/suggestions", headers=auth(parent_a_token), json=SUGGESTION
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/suggestions/{suggestion_id}/replies",
            headers=auth(admin_token),
            json={"message": "Thank you, we are discussing this with the kitchen."},
        )
        assert response.status_code == 201

        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert any(item["type"] == "SUGGESTION_REPLY" for item in inbox)

        detail = client.get(
            f"/api/suggestions/{suggestion_id}", headers=auth(parent_a_token)
        ).get_json()["data"]
        assert detail["status"] == "UNDER_REVIEW"
        assert len(detail["replies"]) == 1

    def test_parent_can_reply_to_own_thread(self, client, parent_a_token, admin_token):
        suggestion_id = client.post(
            "/api/suggestions", headers=auth(parent_a_token), json=SUGGESTION
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/suggestions/{suggestion_id}/replies",
            headers=auth(parent_a_token),
            json={"message": "Adding one more detail."},
        )
        assert response.status_code == 201

    def test_student_issue_report_is_stored_as_feedback(self, client, student_a_token, admin_token):
        response = client.post(
            "/api/student/report-issue",
            headers=auth(student_a_token),
            json={"subject": "Leaking tap in room 101", "message": "Water drips all night."},
        )
        assert response.status_code == 201
        assert response.get_json()["data"]["source"] == "STUDENT"
        admin_view = client.get("/api/suggestions", headers=auth(admin_token)).get_json()["data"]
        assert admin_view[0]["author_role"] == "STUDENT"

    def test_short_message_is_rejected(self, client, parent_a_token):
        response = client.post(
            "/api/suggestions",
            headers=auth(parent_a_token),
            json={"subject": "Hi", "category": "food", "message": "x"},
        )
        assert response.status_code == 422


class TestNotifications:
    def test_unread_count_and_mark_read(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick", "symptoms": "fever"},
        )
        count = client.get("/api/notifications/unread-count", headers=auth(parent_a_token))
        assert count.get_json()["data"]["unread_count"] >= 1

        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        notification_id = inbox[0]["id"]
        marked = client.post(
            f"/api/notifications/{notification_id}/read", headers=auth(parent_a_token)
        )
        assert marked.get_json()["data"]["is_read"] is True

    def test_mark_all_read(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick", "symptoms": "fever"},
        )
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "absent"},
        )
        response = client.post("/api/notifications/read-all", headers=auth(parent_a_token))
        assert response.get_json()["data"]["updated"] >= 2
        assert (
            client.get("/api/notifications/unread-count", headers=auth(parent_a_token)).get_json()[
                "data"
            ]["unread_count"]
            == 0
        )

    def test_filter_unread_only(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "absent"},
        )
        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        client.post(f"/api/notifications/{inbox[0]['id']}/read", headers=auth(parent_a_token))
        unread = client.get(
            "/api/notifications?unread_only=true", headers=auth(parent_a_token)
        ).get_json()["data"]
        assert all(item["is_read"] is False for item in unread)

    def test_delete_notification(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "absent"},
        )
        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert client.delete(
            f"/api/notifications/{inbox[0]['id']}", headers=auth(parent_a_token)
        ).status_code == 200


class TestAnnouncements:
    def test_all_parents_announcement_reaches_verified_parents(
        self, client, admin_token, parent_a_token, pending_parent_token
    ):
        response = client.post(
            "/api/announcements",
            headers=auth(admin_token),
            json={
                "title": "Parent-teacher meeting",
                "description": "Saturday 10 AM in the common hall.",
                "audience": "all_parents",
            },
        )
        assert response.status_code == 201

        visible = client.get("/api/announcements", headers=auth(parent_a_token)).get_json()["data"]
        assert any(item["title"] == "Parent-teacher meeting" for item in visible)

        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert any(item["type"] == "ANNOUNCEMENT" for item in inbox)

        # Unverified parents are not notified.
        pending_inbox = client.get(
            "/api/notifications", headers=auth(pending_parent_token)
        ).get_json()["data"]
        assert not any(item["type"] == "ANNOUNCEMENT" for item in pending_inbox)

    def test_class_targeted_announcement(self, client, world, admin_token, parent_a_token, parent_b_token):
        client.post(
            "/api/announcements",
            headers=auth(admin_token),
            json={
                "title": "Class 8 extra class",
                "description": "Maths revision at 4 PM.",
                "audience": "specific_class",
                "target_class": "Class 8",
            },
        )
        # Both students are Class 8 in the fixture, so both parents see it.
        for token in (parent_a_token, parent_b_token):
            titles = {
                item["title"]
                for item in client.get("/api/announcements", headers=auth(token)).get_json()["data"]
            }
            assert "Class 8 extra class" in titles

    def test_student_specific_announcement_is_scoped(
        self, client, world, admin_token, parent_a_token, parent_b_token
    ):
        client.post(
            "/api/announcements",
            headers=auth(admin_token),
            json={
                "title": "Bring sports kit",
                "description": "For tomorrow's trial.",
                "audience": "specific_student",
                "target_student_id": world["student_a"].id,
            },
        )
        a_titles = {
            item["title"]
            for item in client.get("/api/announcements", headers=auth(parent_a_token)).get_json()["data"]
        }
        b_titles = {
            item["title"]
            for item in client.get("/api/announcements", headers=auth(parent_b_token)).get_json()["data"]
        }
        assert "Bring sports kit" in a_titles
        assert "Bring sports kit" not in b_titles

    def test_specific_student_audience_requires_target(self, client, admin_token):
        response = client.post(
            "/api/announcements",
            headers=auth(admin_token),
            json={"title": "Oops", "description": "No target", "audience": "specific_student"},
        )
        assert response.status_code == 422

    def test_end_date_must_follow_start_date(self, client, admin_token):
        response = client.post(
            "/api/announcements",
            headers=auth(admin_token),
            json={
                "title": "Bad dates",
                "description": "Test",
                "audience": "all_parents",
                "start_date": "2026-05-10",
                "end_date": "2026-05-01",
            },
        )
        assert response.status_code == 422

    def test_expired_announcement_is_hidden(self, client, admin_token, parent_a_token):
        client.post(
            "/api/announcements",
            headers=auth(admin_token),
            json={
                "title": "Old news",
                "description": "Long gone",
                "audience": "all_parents",
                "start_date": "2025-01-01",
                "end_date": "2025-01-31",
            },
        )
        titles = {
            item["title"]
            for item in client.get("/api/announcements", headers=auth(parent_a_token)).get_json()["data"]
        }
        assert "Old news" not in titles

    def test_update_and_delete(self, client, admin_token):
        announcement_id = client.post(
            "/api/announcements",
            headers=auth(admin_token),
            json={"title": "Draft", "description": "Body", "audience": "all_parents"},
        ).get_json()["data"]["id"]
        patched = client.patch(
            f"/api/announcements/{announcement_id}",
            headers=auth(admin_token),
            json={"title": "Final", "is_active": False},
        )
        assert patched.get_json()["data"]["title"] == "Final"
        assert client.delete(
            f"/api/announcements/{announcement_id}", headers=auth(admin_token)
        ).status_code == 200


class TestEmergencyAlerts:
    def test_alert_to_all_parents(self, client, admin_token, parent_a_token):
        response = client.post(
            "/api/emergency-alerts",
            headers=auth(admin_token),
            json={
                "alert_type": "hostel_emergency",
                "audience": "all_parents",
                "title": "Water supply interruption",
                "message": "Water will be off from 2 PM to 5 PM today.",
            },
        )
        assert response.status_code == 201
        assert response.get_json()["data"]["recipient_count"] == 2  # only verified parents

        alerts = client.get("/api/emergency-alerts", headers=auth(parent_a_token)).get_json()["data"]
        assert len(alerts) == 1
        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert inbox[0]["priority"] == "URGENT"

    def test_single_parent_alert_targets_one_family(
        self, client, world, admin_token, parent_a_token, parent_b_token
    ):
        client.post(
            "/api/emergency-alerts",
            headers=auth(admin_token),
            json={
                "alert_type": "medical_emergency",
                "audience": "single_parent",
                "student_id": world["student_a"].id,
                "title": "Medical attention needed",
                "message": "Please call the hostel office immediately.",
            },
        )
        assert len(client.get("/api/emergency-alerts", headers=auth(parent_a_token)).get_json()["data"]) == 1
        assert client.get("/api/emergency-alerts", headers=auth(parent_b_token)).get_json()["data"] == []

    def test_single_parent_alert_requires_student(self, client, admin_token):
        response = client.post(
            "/api/emergency-alerts",
            headers=auth(admin_token),
            json={
                "alert_type": "medical_emergency",
                "audience": "single_parent",
                "title": "x",
                "message": "message body",
            },
        )
        assert response.status_code == 422

    def test_selected_parents_alert(self, client, world, admin_token, parent_b_token):
        response = client.post(
            "/api/emergency-alerts",
            headers=auth(admin_token),
            json={
                "alert_type": "important_announcement",
                "audience": "selected_parents",
                "parent_ids": [world["parent_b"].id],
                "title": "Selected notice",
                "message": "Applies to selected families only.",
            },
        )
        assert response.get_json()["data"]["recipient_count"] == 1
        assert len(client.get("/api/emergency-alerts", headers=auth(parent_b_token)).get_json()["data"]) == 1

    def test_acknowledge_and_resolve(self, client, world, admin_token, parent_a_token):
        alert_id = client.post(
            "/api/emergency-alerts",
            headers=auth(admin_token),
            json={
                "alert_type": "natural_disaster",
                "audience": "all_parents",
                "title": "Heavy rain advisory",
                "message": "Students will remain in the hostel today.",
            },
        ).get_json()["data"]["id"]

        assert client.post(
            f"/api/emergency-alerts/{alert_id}/acknowledge", headers=auth(parent_a_token)
        ).status_code == 200
        detail = client.get(f"/api/emergency-alerts/{alert_id}", headers=auth(admin_token)).get_json()["data"]
        assert detail["acknowledged_count"] == 1

        client.post(f"/api/emergency-alerts/{alert_id}/resolve", headers=auth(admin_token))
        assert client.get("/api/emergency-alerts", headers=auth(parent_a_token)).get_json()["data"] == []

    def test_alert_counts_in_admin_summary(self, client, admin_token):
        client.post(
            "/api/emergency-alerts",
            headers=auth(admin_token),
            json={
                "alert_type": "hostel_emergency",
                "audience": "all_parents",
                "title": "Test",
                "message": "Message body here.",
            },
        )
        summary = client.get("/api/admin/summary", headers=auth(admin_token)).get_json()["data"]
        assert summary["active_alerts"] == 1


class TestReports:
    REPORTS = [
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

    def test_all_reports_render_as_json(self, client, admin_token):
        for report in self.REPORTS:
            response = client.get(f"/api/reports/{report}", headers=auth(admin_token))
            assert response.status_code == 200, report
            data = response.get_json()["data"]
            assert data["headers"] and "rows" in data

    def test_csv_export(self, client, admin_token):
        response = client.get("/api/reports/student-list?format=csv", headers=auth(admin_token))
        assert response.status_code == 200
        assert response.mimetype == "text/csv"
        assert "attachment" in response.headers["Content-Disposition"]
        body = response.get_data(as_text=True)
        assert "Student ID" in body and "HMS0001" in body

    def test_pdf_export(self, client, admin_token):
        response = client.get("/api/reports/daily-attendance?format=pdf", headers=auth(admin_token))
        assert response.status_code == 200
        assert response.mimetype == "application/pdf"
        assert response.get_data()[:4] == b"%PDF"

    def test_export_is_audited(self, client, admin_token):
        client.get("/api/reports/student-list?format=csv", headers=auth(admin_token))
        assert AuditLog.query.filter_by(action="REPORT_EXPORTED").count() == 1

    def test_unknown_report_type(self, client, admin_token):
        response = client.get("/api/reports/not-a-report", headers=auth(admin_token))
        assert response.status_code == 422

    def test_unknown_format(self, client, admin_token):
        response = client.get("/api/reports/student-list?format=xlsx", headers=auth(admin_token))
        assert response.status_code == 422

    def test_daily_attendance_includes_unmarked_students(self, client, world, admin_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        data = client.get("/api/reports/daily-attendance", headers=auth(admin_token)).get_json()["data"]
        statuses = [row[4] for row in data["rows"]]
        assert "PRESENT" in statuses and "NOT MARKED" in statuses


class TestAuditTrail:
    def test_significant_actions_are_logged(self, client, world, admin_token):
        client.post(f"/api/parents/{world['pending_parent'].id}/verify", headers=auth(admin_token))
        client.post(f"/api/students/{world['student_a'].id}/block", headers=auth(admin_token), json={})
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_b"].id, "status": "absent"},
        )
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_b"].id, "status": "sick", "symptoms": "fever"},
        )
        client.post("/api/meals", headers=auth(admin_token), json={"meal_type": "lunch"})

        actions = {row.action for row in AuditLog.query.all()}
        assert {
            "PARENT_VERIFIED",
            "STUDENT_BLOCKED",
            "ATTENDANCE_RECORDED",
            "HEALTH_RECORD_CREATED",
            "MEAL_UPLOADED",
        } <= actions

    def test_audit_entries_capture_actor_and_ip(self, client, world, admin_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        entry = AuditLog.query.filter_by(action="ATTENDANCE_RECORDED").one()
        assert entry.admin_id == world["admin"].id
        assert entry.admin_name == world["admin"].full_name
        assert entry.ip_address is not None
        assert entry.description

    def test_audit_log_endpoint_is_filterable(self, client, world, admin_token):
        client.post(f"/api/parents/{world['pending_parent'].id}/verify", headers=auth(admin_token))
        response = client.get("/api/admin/audit-logs?action=PARENT_VERIFIED", headers=auth(admin_token))
        rows = response.get_json()["data"]
        assert rows and all(row["action"] == "PARENT_VERIFIED" for row in rows)

    def test_login_is_audited(self, client, world):
        login(client, world["admin"].email)
        assert AuditLog.query.filter_by(action="LOGIN").count() >= 1


class TestMetaEndpoints:
    def test_health_probe(self, client, world):
        response = client.get("/api/healthz")
        assert response.status_code == 200
        assert response.get_json()["data"]["database"] == "up"

    def test_health_probe_does_not_shadow_health_records(self, client, world, admin_token):
        """/api/health must serve health records, not the liveness probe."""
        response = client.get("/api/health", headers=auth(admin_token))
        assert response.status_code == 200
        assert isinstance(response.get_json()["data"], list)

    def test_meta_enumerations(self, client, world):
        data = client.get("/api/meta").get_json()["data"]
        assert "PRESENT" in data["attendance_statuses"]
        assert "HOSPITALIZED" in data["health_statuses"]
        assert "EVENING_SNACK" in data["meal_types"]

    def test_security_headers_are_applied(self, client, world):
        response = client.get("/api/health")
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_consistent_error_envelope(self, client, world):
        response = client.get("/api/students/999999", headers=auth(login(client, world["admin"].email)))
        body = response.get_json()
        assert response.status_code == 404
        assert body["success"] is False and "message" in body
