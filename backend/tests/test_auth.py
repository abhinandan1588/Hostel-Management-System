"""Registration, login, tokens and password lifecycle."""

from app.constants import AccountStatus, UserRole, VerificationStatus
from app.extensions import db
from app.models import Parent, User

from .conftest import PASSWORD, auth, login, make_student

REGISTRATION = {
    "full_name": "New Parent",
    "email": "new.parent@test.local",
    "phone": "+919812345678",
    "password": PASSWORD,
    "confirm_password": PASSWORD,
    "address": "22 Hill Road, Ranchi",
    "relationship_to_student": "Father",
    "student_code": "HMS0001",
}


class TestRegistration:
    def test_parent_registration_creates_pending_account(self, client, world):
        response = client.post("/api/auth/register", json=REGISTRATION)
        assert response.status_code == 201
        body = response.get_json()
        assert body["success"] is True
        assert body["data"]["requires_verification"] is True
        # The claimed student was pre-linked for the admin review screen.
        assert body["data"]["matched_student"]["student_code"] == "HMS0001"

        user = User.query.filter_by(email="new.parent@test.local").one()
        assert user.role == UserRole.PARENT
        assert user.account_status == AccountStatus.PENDING_VERIFICATION
        assert user.parent_profile.verification_status == VerificationStatus.PENDING

    def test_password_is_hashed_not_stored_plaintext(self, client, world):
        client.post("/api/auth/register", json=REGISTRATION)
        user = User.query.filter_by(email="new.parent@test.local").one()
        assert user.password_hash != PASSWORD
        assert PASSWORD not in user.password_hash
        assert user.check_password(PASSWORD)

    def test_duplicate_email_is_rejected(self, client, world):
        client.post("/api/auth/register", json=REGISTRATION)
        response = client.post("/api/auth/register", json=REGISTRATION)
        assert response.status_code == 409
        assert response.get_json()["success"] is False

    def test_weak_password_is_rejected(self, client, world):
        payload = {**REGISTRATION, "password": "abc", "confirm_password": "abc"}
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 422
        assert "password" in response.get_json()["errors"]

    def test_mismatched_confirmation_is_rejected(self, client, world):
        payload = {**REGISTRATION, "confirm_password": "SomethingElse1"}
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 422

    def test_missing_required_fields_returns_field_errors(self, client, world):
        response = client.post("/api/auth/register", json={"email": "x@y.com"})
        assert response.status_code == 422
        errors = response.get_json()["errors"]
        assert "full_name" in errors and "password" in errors


class TestLogin:
    def test_login_with_email(self, client, world):
        response = client.post(
            "/api/auth/login",
            json={"identifier": world["admin"].email, "password": PASSWORD},
        )
        assert response.status_code == 200
        data = response.get_json()["data"]
        assert data["access_token"] and data["refresh_token"]
        assert data["user"]["role"] == "ADMIN"

    def test_login_with_wrong_password_is_generic(self, client, world):
        response = client.post(
            "/api/auth/login",
            json={"identifier": world["admin"].email, "password": "WrongPassword1"},
        )
        assert response.status_code == 401
        assert response.get_json()["message"] == "Invalid email or password."

    def test_unknown_account_gives_same_message(self, client, world):
        response = client.post(
            "/api/auth/login",
            json={"identifier": "nobody@test.local", "password": PASSWORD},
        )
        assert response.status_code == 401
        assert response.get_json()["message"] == "Invalid email or password."

    def test_blocked_user_cannot_log_in(self, client, world):
        user = world["parent_a"].user
        user.account_status = AccountStatus.BLOCKED
        db.session.commit()
        response = client.post(
            "/api/auth/login", json={"identifier": user.email, "password": PASSWORD}
        )
        assert response.status_code == 403
        assert "blocked" in response.get_json()["message"].lower()

    def test_rejected_user_cannot_log_in(self, client, world):
        user = world["parent_b"].user
        user.account_status = AccountStatus.REJECTED
        db.session.commit()
        response = client.post(
            "/api/auth/login", json={"identifier": user.email, "password": PASSWORD}
        )
        assert response.status_code == 403

    def test_unverified_parent_can_log_in_but_is_flagged(self, client, world):
        response = client.post(
            "/api/auth/login",
            json={"identifier": world["pending_parent"].user.email, "password": PASSWORD},
        )
        assert response.status_code == 200
        assert response.get_json()["data"]["requires_verification"] is True

    def test_repeated_failures_block_the_account(self, client, app, world):
        user = world["parent_a"].user
        limit = app.config["MAX_FAILED_LOGIN_ATTEMPTS"]
        for _ in range(limit):
            client.post(
                "/api/auth/login", json={"identifier": user.email, "password": "Nope12345"}
            )
        db.session.refresh(user)
        assert user.account_status == AccountStatus.BLOCKED


class TestTokens:
    def test_me_returns_session_payload(self, client, admin_token):
        response = client.get("/api/auth/me", headers=auth(admin_token))
        assert response.status_code == 200
        data = response.get_json()["data"]
        assert data["user"]["role"] == "ADMIN"
        assert data["permissions"]["manage_students"] is True

    def test_request_without_token_is_unauthorized(self, client, world):
        assert client.get("/api/auth/me").status_code == 401

    def test_invalid_token_is_rejected(self, client, world):
        response = client.get("/api/auth/me", headers=auth("not-a-real-token"))
        assert response.status_code in (401, 422)

    def test_refresh_issues_a_new_access_token(self, client, world):
        login_response = client.post(
            "/api/auth/login",
            json={"identifier": world["admin"].email, "password": PASSWORD},
        )
        refresh_token = login_response.get_json()["data"]["refresh_token"]
        response = client.post("/api/auth/refresh", headers=auth(refresh_token))
        assert response.status_code == 200
        assert response.get_json()["data"]["access_token"]

    def test_logout_revokes_the_token(self, client, admin_token):
        assert client.post("/api/auth/logout", headers=auth(admin_token)).status_code == 200
        # The same token must no longer work.
        assert client.get("/api/auth/me", headers=auth(admin_token)).status_code == 401


class TestPasswordReset:
    def test_forgot_password_never_reveals_account_existence(self, client, world):
        known = client.post(
            "/api/auth/forgot-password", json={"email": world["admin"].email}
        )
        unknown = client.post(
            "/api/auth/forgot-password", json={"email": "ghost@test.local"}
        )
        assert known.status_code == unknown.status_code == 200
        assert known.get_json()["message"] == unknown.get_json()["message"]

    def test_reset_password_flow(self, client, world):
        email = world["parent_a"].user.email
        forgot = client.post("/api/auth/forgot-password", json={"email": email})
        token = forgot.get_json()["data"]["reset_token"]

        response = client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "BrandNew123", "confirm_password": "BrandNew123"},
        )
        assert response.status_code == 200
        assert login(client, email, "BrandNew123")

    def test_reset_token_is_single_use(self, client, world):
        email = world["parent_a"].user.email
        token = (
            client.post("/api/auth/forgot-password", json={"email": email})
            .get_json()["data"]["reset_token"]
        )
        client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "BrandNew123"},
        )
        second = client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "AnotherOne123"},
        )
        assert second.status_code == 422

    def test_invalid_reset_token_is_rejected(self, client, world):
        response = client.post(
            "/api/auth/reset-password",
            json={"token": "x" * 40, "password": "BrandNew123"},
        )
        assert response.status_code == 422

    def test_change_password_requires_current_password(self, client, parent_a_token):
        response = client.post(
            "/api/auth/change-password",
            headers=auth(parent_a_token),
            json={"current_password": "WrongPass1", "new_password": "BrandNew123"},
        )
        assert response.status_code == 422

    def test_change_password_succeeds(self, client, world, parent_a_token):
        response = client.post(
            "/api/auth/change-password",
            headers=auth(parent_a_token),
            json={"current_password": PASSWORD, "new_password": "BrandNew123"},
        )
        assert response.status_code == 200
        assert login(client, world["parent_a"].user.email, "BrandNew123")


class TestOwnProfile:
    def test_parent_can_update_own_profile(self, client, parent_a_token):
        response = client.patch(
            "/api/auth/profile",
            headers=auth(parent_a_token),
            json={"full_name": "Updated Name", "city": "Ranchi"},
        )
        assert response.status_code == 200
        assert response.get_json()["data"]["user"]["full_name"] == "Updated Name"


class TestAdminCreation:
    def test_super_admin_can_create_admin(self, client, admin_token):
        response = client.post(
            "/api/admin/admins",
            headers=auth(admin_token),
            json={
                "full_name": "Second Warden",
                "email": "warden2@test.local",
                "password": PASSWORD,
            },
        )
        assert response.status_code == 201
        assert User.query.filter_by(email="warden2@test.local").one().role == UserRole.ADMIN

    def test_non_super_admin_cannot_create_admin(self, client, world):
        from .conftest import make_admin

        plain_admin = make_admin("plain.admin@test.local", is_super_admin=False)
        token = login(client, plain_admin.email)
        response = client.post(
            "/api/admin/admins",
            headers=auth(token),
            json={"full_name": "X", "email": "x@test.local", "password": PASSWORD},
        )
        assert response.status_code == 403

    def test_parent_cannot_create_admin(self, client, parent_a_token):
        response = client.post(
            "/api/admin/admins",
            headers=auth(parent_a_token),
            json={"full_name": "X", "email": "x@test.local", "password": PASSWORD},
        )
        assert response.status_code == 403


class TestRegistrationLinksLater:
    def test_verification_links_claimed_student_created_afterwards(
        self, client, world, admin_token
    ):
        """A parent may register before the student record exists."""
        payload = {**REGISTRATION, "email": "late@test.local", "student_code": "HMS9999"}
        client.post("/api/auth/register", json=payload)
        parent = (
            Parent.query.join(User, User.id == Parent.user_id)
            .filter(User.email == "late@test.local")
            .one()
        )
        assert parent.student_links == []

        make_student("HMS9999", "Late Student")
        response = client.post(
            f"/api/parents/{parent.id}/verify", headers=auth(admin_token)
        )
        assert response.status_code == 200
        db.session.refresh(parent)
        assert len(parent.student_links) == 1
