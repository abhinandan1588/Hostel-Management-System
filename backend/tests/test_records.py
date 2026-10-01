"""Daily official records: attendance, health, meals, school, activities, progress."""

import io
from datetime import date, timedelta

from PIL import Image

from app.extensions import db
from app.models import AttendanceRecord, Meal

from .conftest import auth


def fake_image(color=(90, 140, 240), size=(400, 300), fmt="JPEG"):
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format=fmt)
    buffer.seek(0)
    return buffer


class TestAttendance:
    def test_record_attendance(self, client, world, admin_token):
        response = client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present", "remarks": "On time"},
        )
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert data["status"] == "PRESENT" and data["marked_by"] is not None

    def test_recording_twice_updates_the_same_row(self, client, world, admin_token):
        payload = {"student_id": world["student_a"].id, "status": "present"}
        first = client.post("/api/attendance", headers=auth(admin_token), json=payload)
        second = client.post(
            "/api/attendance", headers=auth(admin_token), json={**payload, "status": "late"}
        )
        assert first.get_json()["data"]["id"] == second.get_json()["data"]["id"]
        assert AttendanceRecord.query.count() == 1
        assert second.get_json()["data"]["status"] == "LATE"

    def test_status_values_are_validated(self, client, world, admin_token):
        response = client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "maybe"},
        )
        assert response.status_code == 422

    def test_absent_notifies_guardians(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "absent"},
        )
        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert any(item["type"] == "ATTENDANCE_ALERT" for item in inbox)

    def test_present_does_not_notify(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert not any(item["type"] == "ATTENDANCE_ALERT" for item in inbox)

    def test_bulk_recording(self, client, world, admin_token):
        response = client.post(
            "/api/attendance/bulk",
            headers=auth(admin_token),
            json={
                "records": [
                    {"student_id": world["student_a"].id, "status": "present"},
                    {"student_id": world["student_b"].id, "status": "absent"},
                    {"student_id": world["student_c"].id, "status": "leave"},
                ]
            },
        )
        assert response.status_code == 201
        assert len(response.get_json()["data"]) == 3

    def test_daily_sheet_shows_pending_students(self, client, world, admin_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        sheet = client.get("/api/attendance/sheet", headers=auth(admin_token)).get_json()["data"]
        assert sheet["total_students"] == 3
        assert sheet["marked"] == 1 and sheet["pending"] == 2

    def test_summary_percentage_counts_late_as_present(self, client, world, admin_token):
        student_id = world["student_a"].id
        today = date.today()
        for offset, status in enumerate(["present", "late", "absent", "leave"]):
            client.post(
                "/api/attendance",
                headers=auth(admin_token),
                json={
                    "student_id": student_id,
                    "status": status,
                    "date": (today - timedelta(days=offset)).isoformat(),
                },
            )
        response = client.get(f"/api/attendance/{student_id}/summary", headers=auth(admin_token))
        summary = response.get_json()["data"]
        assert summary["recorded_days"] == 4
        assert summary["attendance_percentage"] == 50.0

    def test_calendar_returns_every_day_of_month(self, client, world, admin_token):
        response = client.get(
            f"/api/attendance/{world['student_a'].id}/calendar?year=2026&month=2",
            headers=auth(admin_token),
        )
        days = response.get_json()["data"]["days"]
        assert len(days) == 28

    def test_admin_can_correct_and_delete_a_record(self, client, world, admin_token):
        record_id = client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "absent"},
        ).get_json()["data"]["id"]
        patched = client.patch(
            f"/api/attendance/{record_id}",
            headers=auth(admin_token),
            json={"status": "present", "remarks": "Corrected"},
        )
        assert patched.get_json()["data"]["status"] == "PRESENT"
        assert client.delete(f"/api/attendance/{record_id}", headers=auth(admin_token)).status_code == 200
        assert AttendanceRecord.query.count() == 0


class TestHealth:
    def test_create_health_record(self, client, world, admin_token):
        response = client.post(
            "/api/health",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "status": "sick",
                "symptoms": "Fever and cough",
                "temperature": 38.5,
                "medicine_given": "Paracetamol",
                "doctor_visited": True,
                "doctor_name": "Dr. Rao",
            },
        )
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert data["status"] == "SICK" and data["severity"] == "MEDIUM"
        assert data["temperature"] == 38.5

    def test_symptoms_required_for_non_healthy_status(self, client, world, admin_token):
        response = client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick"},
        )
        assert response.status_code == 422

    def test_temperature_range_validated(self, client, world, admin_token):
        response = client.post(
            "/api/health",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "status": "sick",
                "symptoms": "x",
                "temperature": 99,
            },
        )
        assert response.status_code == 422

    def test_hospitalized_is_urgent_and_notifies(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "status": "hospitalized",
                "symptoms": "Severe dehydration",
                "hospital_visit": True,
                "hospital_name": "City Hospital",
            },
        )
        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        alert = next(item for item in inbox if item["type"] == "HEALTH_ALERT")
        assert alert["priority"] == "URGENT"

    def test_current_status_defaults_to_healthy(self, client, world, admin_token):
        response = client.get(
            f"/api/health/{world['student_b'].id}/current", headers=auth(admin_token)
        )
        assert response.get_json()["data"]["status"] == "HEALTHY"

    def test_mark_recovered(self, client, world, admin_token):
        record_id = client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick", "symptoms": "flu"},
        ).get_json()["data"]["id"]
        response = client.post(f"/api/health/{record_id}/recovered", headers=auth(admin_token))
        data = response.get_json()["data"]
        assert data["recovery_status"] == "RECOVERED" and data["status"] == "HEALTHY"

    def test_hostel_overview_counts_untracked_students_as_healthy(
        self, client, world, admin_token
    ):
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick", "symptoms": "flu"},
        )
        counts = client.get("/api/health/overview", headers=auth(admin_token)).get_json()["data"][
            "counts"
        ]
        assert counts["TOTAL_STUDENTS"] == 3
        assert counts["SICK"] == 1
        assert counts["HEALTHY"] == 2
        assert counts["NEEDS_ATTENTION"] == 1

    def test_parent_sees_only_own_child_health_timeline(
        self, client, world, admin_token, parent_a_token
    ):
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "sick", "symptoms": "flu"},
        )
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_c"].id, "status": "sick", "symptoms": "cold"},
        )
        rows = client.get("/api/health", headers=auth(parent_a_token)).get_json()["data"]
        assert {row["student_id"] for row in rows} == {world["student_a"].id}


class TestMeals:
    def test_record_meal(self, client, admin_token):
        response = client.post(
            "/api/meals",
            headers=auth(admin_token),
            json={
                "meal_type": "lunch",
                "food_items": ["Rice", "Dal", "Vegetable", "Curd"],
                "served_at": "12:45",
                "remarks": "Fresh vegetables",
            },
        )
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert data["food_items"] == ["Rice", "Dal", "Vegetable", "Curd"]
        assert data["served_at"] == "12:45:00"

    def test_one_record_per_meal_slot_per_day(self, client, admin_token):
        client.post("/api/meals", headers=auth(admin_token), json={"meal_type": "lunch"})
        client.post(
            "/api/meals",
            headers=auth(admin_token),
            json={"meal_type": "lunch", "food_items": ["Khichdi"]},
        )
        assert Meal.query.count() == 1

    def test_day_menu_lists_all_four_slots(self, client, admin_token):
        response = client.get("/api/meals/today", headers=auth(admin_token))
        slots = response.get_json()["data"]["slots"]
        assert [slot["meal_type"] for slot in slots] == [
            "BREAKFAST",
            "LUNCH",
            "EVENING_SNACK",
            "DINNER",
        ]
        assert all(slot["recorded"] is False for slot in slots)

    def test_photo_upload_and_delete(self, client, admin_token):
        meal_id = client.post(
            "/api/meals", headers=auth(admin_token), json={"meal_type": "dinner"}
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/meals/id/{meal_id}/photos",
            headers=auth(admin_token),
            data={"photos": (fake_image(), "dinner.jpg")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 201
        photos = response.get_json()["data"]["meal"]["photos"]
        assert len(photos) == 1
        # The stored filename is server generated, never the uploaded name.
        assert "dinner.jpg" not in photos[0]["file_path"]

        assert client.delete(
            f"/api/meals/photos/{photos[0]['id']}", headers=auth(admin_token)
        ).status_code == 200

    def test_non_image_upload_is_rejected(self, client, admin_token):
        meal_id = client.post(
            "/api/meals", headers=auth(admin_token), json={"meal_type": "breakfast"}
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/meals/id/{meal_id}/photos",
            headers=auth(admin_token),
            data={"photos": (io.BytesIO(b"#!/bin/sh\nrm -rf /"), "evil.jpg")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 422

    def test_disallowed_extension_is_rejected(self, client, admin_token):
        meal_id = client.post(
            "/api/meals", headers=auth(admin_token), json={"meal_type": "breakfast"}
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/meals/id/{meal_id}/photos",
            headers=auth(admin_token),
            data={"photos": (fake_image(), "payload.svg")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 422

    def test_parents_can_view_meals(self, client, admin_token, parent_a_token):
        client.post(
            "/api/meals",
            headers=auth(admin_token),
            json={"meal_type": "lunch", "food_items": ["Rice"]},
        )
        response = client.get("/api/meals/today", headers=auth(parent_a_token))
        assert response.status_code == 200
        lunch = next(s for s in response.get_json()["data"]["slots"] if s["meal_type"] == "LUNCH")
        assert lunch["recorded"] is True


class TestSchoolAttendance:
    def test_record_and_sync_student_status(self, client, world, admin_token):
        student = world["student_a"]
        response = client.post(
            "/api/school-attendance",
            headers=auth(admin_token),
            json={
                "student_id": student.id,
                "status": "went_to_school",
                "departure_time": "07:30",
                "expected_return_time": "14:00",
            },
        )
        assert response.status_code == 201
        assert response.get_json()["data"]["departure_time"] == "07:30:00"
        db.session.refresh(student)
        assert student.current_status.value == "AT_SCHOOL"

    def test_mark_returned_updates_status_and_notifies(
        self, client, world, admin_token, parent_a_token
    ):
        student = world["student_a"]
        record_id = client.post(
            "/api/school-attendance",
            headers=auth(admin_token),
            json={"student_id": student.id, "status": "went_to_school", "departure_time": "07:30"},
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/school-attendance/{record_id}/returned",
            headers=auth(admin_token),
            json={"actual_return_time": "14:15"},
        )
        assert response.status_code == 200
        assert response.get_json()["data"]["actual_return_time"] == "14:15:00"
        db.session.refresh(student)
        assert student.current_status.value == "RETURNED_TO_HOSTEL"

        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert any(item["type"] == "SCHOOL_STATUS" for item in inbox)

    def test_twelve_hour_time_format_accepted(self, client, world, admin_token):
        response = client.post(
            "/api/school-attendance",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "status": "went_to_school",
                "departure_time": "07:30 AM",
            },
        )
        assert response.status_code == 201
        assert response.get_json()["data"]["departure_time"] == "07:30:00"

    def test_daily_sheet_counts(self, client, world, admin_token):
        client.post(
            "/api/school-attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "went_to_school"},
        )
        sheet = client.get("/api/school-attendance/sheet", headers=auth(admin_token)).get_json()[
            "data"
        ]
        assert sheet["counts"]["WENT_TO_SCHOOL"] == 1
        assert sheet["counts"]["NOT_MARKED"] == 2


class TestActivities:
    def test_create_activity(self, client, world, admin_token):
        response = client.post(
            "/api/activities",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "activity_type": "breakfast",
                "scheduled_time": "07:00",
            },
        )
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert data["title"] == "Breakfast" and data["is_completed"] is False

    def test_generate_routine_creates_full_day(self, client, world, admin_token):
        response = client.post(
            "/api/activities/generate-routine",
            headers=auth(admin_token),
            json={"student_ids": [world["student_a"].id]},
        )
        assert response.status_code == 201
        assert response.get_json()["data"]["created"] == 10

        timeline = client.get(
            f"/api/activities/{world['student_a'].id}", headers=auth(admin_token)
        ).get_json()["data"]
        assert timeline["total"] == 10
        # Ordered by scheduled time.
        times = [item["scheduled_time"] for item in timeline["items"]]
        assert times == sorted(times)

    def test_generate_routine_is_idempotent(self, client, world, admin_token):
        payload = {"student_ids": [world["student_a"].id]}
        client.post("/api/activities/generate-routine", headers=auth(admin_token), json=payload)
        second = client.post(
            "/api/activities/generate-routine", headers=auth(admin_token), json=payload
        )
        assert second.get_json()["data"]["created"] == 0

    def test_complete_activity_stamps_time(self, client, world, admin_token):
        activity_id = client.post(
            "/api/activities",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "activity_type": "lunch"},
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/activities/{activity_id}/complete", headers=auth(admin_token)
        )
        data = response.get_json()["data"]
        assert data["is_completed"] is True and data["activity_time"] is not None

    def test_bulk_complete(self, client, world, admin_token):
        client.post(
            "/api/activities/generate-routine",
            headers=auth(admin_token),
            json={"student_ids": [world["student_a"].id, world["student_b"].id]},
        )
        response = client.post(
            "/api/activities/bulk-complete",
            headers=auth(admin_token),
            json={
                "student_ids": [world["student_a"].id, world["student_b"].id],
                "activity_type": "breakfast",
            },
        )
        assert response.get_json()["data"]["updated"] == 2

    def test_student_confirmation_does_not_change_official_fields(
        self, client, world, admin_token, student_a_token
    ):
        activity_id = client.post(
            "/api/activities",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "activity_type": "study"},
        ).get_json()["data"]["id"]
        response = client.post(
            f"/api/activities/{activity_id}/confirm", headers=auth(student_a_token)
        )
        data = response.get_json()["data"]
        assert data["confirmed_by_student"] is True
        assert data["is_completed"] is False  # still the warden's call


class TestProgress:
    def test_academic_record_computes_percentage_and_grade(self, client, world, admin_token):
        response = client.post(
            "/api/progress/academic",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "subject": "Mathematics",
                "exam_name": "Monthly Test",
                "marks_obtained": 42,
                "max_marks": 50,
                "teacher_remark": "Good performance",
            },
        )
        assert response.status_code == 201
        data = response.get_json()["data"]
        assert data["percentage"] == 84.0 and data["grade"] == "A"

    def test_marks_cannot_exceed_maximum(self, client, world, admin_token):
        response = client.post(
            "/api/progress/academic",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "subject": "Science",
                "exam_name": "Test",
                "marks_obtained": 60,
                "max_marks": 50,
            },
        )
        assert response.status_code == 422

    def test_academic_result_notifies_guardians(self, client, world, admin_token, parent_a_token):
        client.post(
            "/api/progress/academic",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "subject": "English",
                "exam_name": "Unit Test",
                "marks_obtained": 18,
                "max_marks": 20,
            },
        )
        inbox = client.get("/api/notifications", headers=auth(parent_a_token)).get_json()["data"]
        assert any(item["type"] == "PROGRESS_UPDATE" for item in inbox)

    def test_progress_score_upsert(self, client, world, admin_token):
        payload = {
            "student_id": world["student_a"].id,
            "category_slug": "academic",
            "score": 80,
        }
        first = client.post("/api/progress", headers=auth(admin_token), json=payload)
        second = client.post(
            "/api/progress", headers=auth(admin_token), json={**payload, "score": 91}
        )
        assert first.get_json()["data"]["id"] == second.get_json()["data"]["id"]
        assert second.get_json()["data"]["score"] == 91.0

    def test_score_range_validated(self, client, world, admin_token):
        response = client.post(
            "/api/progress",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "category_slug": "academic", "score": 140},
        )
        assert response.status_code == 422

    def test_bulk_progress_and_overall_average(self, client, world, admin_token):
        response = client.post(
            "/api/progress/bulk",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "scores": [
                    {"category_slug": "academic", "score": 80},
                    {"category_slug": "attendance", "score": 90},
                    {"category_slug": "discipline", "score": 100},
                ],
            },
        )
        assert response.status_code == 201
        current = client.get(
            f"/api/progress/student/{world['student_a'].id}/current", headers=auth(admin_token)
        ).get_json()["data"]
        assert current["overall"] == 90.0

    def test_default_categories_exist(self, client, admin_token):
        response = client.get("/api/progress/categories", headers=auth(admin_token))
        slugs = {row["slug"] for row in response.get_json()["data"]}
        assert {"academic", "attendance", "discipline", "health", "sports"} <= slugs

    def test_overview_bundles_everything(self, client, world, admin_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        client.post(
            "/api/progress/academic",
            headers=auth(admin_token),
            json={
                "student_id": world["student_a"].id,
                "subject": "Maths",
                "exam_name": "T1",
                "marks_obtained": 45,
                "max_marks": 50,
            },
        )
        data = client.get(
            f"/api/progress/student/{world['student_a'].id}", headers=auth(admin_token)
        ).get_json()["data"]
        assert data["attendance"]["percentage"] == 100.0
        assert data["subjects"][0]["subject"] == "Maths"
        assert len(data["academic_trend"]) == 1
        assert len(data["attendance"]["monthly_trend"]) == 6


class TestDashboards:
    def test_admin_dashboard_summary_cards(self, client, world, admin_token):
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_a"].id, "status": "present"},
        )
        client.post(
            "/api/attendance",
            headers=auth(admin_token),
            json={"student_id": world["student_b"].id, "status": "absent"},
        )
        client.post(
            "/api/health",
            headers=auth(admin_token),
            json={"student_id": world["student_c"].id, "status": "sick", "symptoms": "fever"},
        )
        summary = client.get("/api/admin/dashboard", headers=auth(admin_token)).get_json()["data"][
            "summary"
        ]
        assert summary["total_students"] == 3
        assert summary["total_parents"] == 3
        assert summary["pending_parent_verification"] == 1
        assert summary["students_present"] == 1
        assert summary["students_absent"] == 1
        assert summary["students_sick"] == 1

    def test_admin_dashboard_charts_present(self, client, admin_token):
        charts = client.get("/api/admin/dashboard", headers=auth(admin_token)).get_json()["data"][
            "charts"
        ]
        assert set(charts) == {
            "attendance_trend",
            "health_distribution",
            "occupancy_by_building",
            "school_attendance_weekly",
        }

    def test_parent_dashboard_child_selector(self, client, world, parent_a_token):
        data = client.get("/api/parent/dashboard", headers=auth(parent_a_token)).get_json()["data"]
        assert len(data["children"]) == 2
        assert data["selected_child_id"] in {world["student_a"].id, world["student_b"].id}
        assert "timeline" in data["selected_child"]

    def test_parent_dashboard_can_switch_child(self, client, world, parent_a_token):
        target = world["student_b"].id
        data = client.get(
            f"/api/parent/dashboard?student_id={target}", headers=auth(parent_a_token)
        ).get_json()["data"]
        assert data["selected_child_id"] == target

    def test_parent_dashboard_ignores_foreign_child_id(self, client, world, parent_a_token):
        data = client.get(
            f"/api/parent/dashboard?student_id={world['student_c'].id}",
            headers=auth(parent_a_token),
        ).get_json()["data"]
        assert data["selected_child_id"] != world["student_c"].id

    def test_student_dashboard(self, client, world, student_a_token):
        data = client.get("/api/student/dashboard", headers=auth(student_a_token)).get_json()["data"]
        assert data["student"]["id"] == world["student_a"].id
        assert "attendance_month" in data and "progress" in data

    def test_global_search(self, client, admin_token):
        data = client.get("/api/admin/search?q=Student", headers=auth(admin_token)).get_json()["data"]
        assert len(data["students"]) == 3

    def test_global_search_requires_two_characters(self, client, admin_token):
        assert client.get("/api/admin/search?q=a", headers=auth(admin_token)).status_code == 422
