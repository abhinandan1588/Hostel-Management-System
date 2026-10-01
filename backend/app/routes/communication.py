"""Notifications, suggestions, announcements and emergency alerts."""

from flask import Blueprint, request

from ..constants import SuggestionCategory, SuggestionSource
from ..decorators import (
    admin_required,
    auth_required,
    current_parent,
    current_user,
    parent_required,
)
from ..schemas import (
    AnnouncementSchema,
    EmergencyAlertSchema,
    IssueReportSchema,
    SuggestionReplySchema,
    SuggestionSchema,
    SuggestionStatusSchema,
    load_payload,
)
from ..services import communication_service, notification_service
from ..utils.errors import PermissionDenied
from ..utils.request_helpers import bool_arg, form_body, json_body
from ..utils.responses import created, paginated, success

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")
suggestions_bp = Blueprint("suggestions", __name__, url_prefix="/api/suggestions")
announcements_bp = Blueprint("announcements", __name__, url_prefix="/api/announcements")
emergency_bp = Blueprint("emergency", __name__, url_prefix="/api/emergency-alerts")


# ---------------------------------------------------------------------------
# Notifications (own inbox only)
# ---------------------------------------------------------------------------
@notifications_bp.get("")
@auth_required
def list_notifications():
    items, page, per_page, total = notification_service.list_notifications(
        current_user(),
        unread_only=bool_arg("unread_only"),
        notification_type=request.args.get("type"),
    )
    return paginated(
        items,
        page,
        per_page,
        total,
        extra={"unread_count": notification_service.unread_count(current_user())},
    )


@notifications_bp.get("/unread-count")
@auth_required
def unread_count():
    return success({"unread_count": notification_service.unread_count(current_user())})


@notifications_bp.post("/<int:notification_id>/read")
@auth_required
def mark_read(notification_id):
    notification = notification_service.mark_read(current_user(), notification_id)
    return success(notification.to_dict(), message="Notification marked as read")


@notifications_bp.post("/read-all")
@auth_required
def mark_all_read():
    updated = notification_service.mark_all_read(current_user())
    return success({"updated": updated}, message="All notifications marked as read")


@notifications_bp.delete("/<int:notification_id>")
@auth_required
def delete_notification(notification_id):
    notification_service.delete_notification(current_user(), notification_id)
    return success(message="Notification deleted")


# ---------------------------------------------------------------------------
# Suggestions
# ---------------------------------------------------------------------------
def _suggestion_filters():
    return {
        "status": request.args.get("status"),
        "category": request.args.get("category"),
        "student_id": request.args.get("student_id"),
        "q": request.args.get("q"),
    }


@suggestions_bp.get("")
@auth_required
def list_suggestions():
    """Admins see everything; everyone else sees only what they authored."""
    user = current_user()
    if user.is_admin:
        items, page, per_page, total = communication_service.list_suggestions(
            _suggestion_filters()
        )
        return paginated(
            items,
            page,
            per_page,
            total,
            extra={"stats": communication_service.suggestion_stats()},
        )
    items, page, per_page, total = communication_service.list_suggestions(
        _suggestion_filters(), author_id=user.id
    )
    return paginated(items, page, per_page, total)


@suggestions_bp.get("/stats")
@admin_required
def suggestion_stats():
    return success(communication_service.suggestion_stats())


@suggestions_bp.post("")
@parent_required(verified=True)
def create_suggestion():
    """Parent-generated feedback. Never touches official records."""
    body = form_body() if request.files else json_body()
    payload = load_payload(SuggestionSchema, body)
    suggestion = communication_service.create_suggestion(
        payload,
        author=current_user(),
        parent=current_parent(),
        file_storage=request.files.get("attachment"),
        source=SuggestionSource.PARENT,
    )
    return created(suggestion.to_dict(), message="Suggestion sent to the administrator")


@suggestions_bp.get("/<int:suggestion_id>")
@auth_required
def get_suggestion(suggestion_id):
    suggestion = communication_service.get_suggestion(suggestion_id)
    user = current_user()
    if not user.is_admin and suggestion.created_by_id != user.id:
        raise PermissionDenied("You may only view your own suggestions.")
    return success(suggestion.to_dict())


@suggestions_bp.patch("/<int:suggestion_id>/status")
@admin_required
def update_status(suggestion_id):
    suggestion = communication_service.get_suggestion(suggestion_id)
    payload = load_payload(SuggestionStatusSchema, json_body())
    communication_service.update_suggestion_status(
        suggestion, payload["status"], actor=current_user()
    )
    return success(suggestion.to_dict(), message="Suggestion status updated")


@suggestions_bp.post("/<int:suggestion_id>/replies")
@auth_required
def reply(suggestion_id):
    suggestion = communication_service.get_suggestion(suggestion_id)
    user = current_user()
    if not user.is_admin and suggestion.created_by_id != user.id:
        raise PermissionDenied("You may only reply to your own suggestions.")
    payload = load_payload(SuggestionReplySchema, json_body())
    reply_row = communication_service.reply_to_suggestion(
        suggestion, payload["message"], author=user
    )
    return created(reply_row.to_dict(), message="Reply sent")


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------
@announcements_bp.get("")
@auth_required
def list_announcements():
    user = current_user()
    if user.is_admin and not bool_arg("mine"):
        items, page, per_page, total = communication_service.list_announcements(
            {
                "active_only": bool_arg("active_only"),
                "audience": request.args.get("audience"),
                "q": request.args.get("q"),
            }
        )
        return paginated(items, page, per_page, total)
    return success(communication_service.announcements_for_user(user, limit=50))


@announcements_bp.post("")
@admin_required
def create_announcement():
    body = form_body() if request.files else json_body()
    payload = load_payload(AnnouncementSchema, body)
    announcement = communication_service.create_announcement(
        payload, actor=current_user(), file_storage=request.files.get("attachment")
    )
    return created(announcement.to_dict(), message="Announcement published")


@announcements_bp.get("/<int:announcement_id>")
@auth_required
def get_announcement(announcement_id):
    announcement = communication_service.get_announcement(announcement_id)
    return success(announcement.to_dict())


@announcements_bp.patch("/<int:announcement_id>")
@admin_required
def update_announcement(announcement_id):
    announcement = communication_service.get_announcement(announcement_id)
    payload = load_payload(AnnouncementSchema, json_body(), partial=True)
    communication_service.update_announcement(announcement, payload, actor=current_user())
    return success(announcement.to_dict(), message="Announcement updated")


@announcements_bp.delete("/<int:announcement_id>")
@admin_required
def delete_announcement(announcement_id):
    announcement = communication_service.get_announcement(announcement_id)
    communication_service.delete_announcement(announcement, actor=current_user())
    return success(message="Announcement deleted")


# ---------------------------------------------------------------------------
# Emergency alerts
# ---------------------------------------------------------------------------
@emergency_bp.get("")
@auth_required
def list_alerts():
    user = current_user()
    if user.is_admin:
        items, page, per_page, total = communication_service.list_alerts(
            {"active_only": bool_arg("active_only")}
        )
        return paginated(items, page, per_page, total)
    return success(communication_service.active_alerts_for_user(user))


@emergency_bp.post("")
@admin_required
def send_alert():
    payload = load_payload(EmergencyAlertSchema, json_body())
    alert = communication_service.send_emergency_alert(payload, actor=current_user())
    return created(
        alert.to_dict(include_recipients=True),
        message=f"Emergency alert sent to {len(alert.recipients)} recipient(s)",
    )


@emergency_bp.get("/<int:alert_id>")
@admin_required
def get_alert(alert_id):
    alert = communication_service.get_alert(alert_id)
    return success(alert.to_dict(include_recipients=True))


@emergency_bp.post("/<int:alert_id>/resolve")
@admin_required
def resolve_alert(alert_id):
    alert = communication_service.get_alert(alert_id)
    communication_service.resolve_alert(alert, actor=current_user())
    return success(alert.to_dict(), message="Emergency alert resolved")


@emergency_bp.post("/<int:alert_id>/acknowledge")
@auth_required
def acknowledge(alert_id):
    recipient = communication_service.acknowledge_alert(alert_id, current_user())
    return success(recipient.to_dict(), message="Alert acknowledged")


# ---------------------------------------------------------------------------
# Student issue reports (user generated, routed as a suggestion)
# ---------------------------------------------------------------------------
def create_issue_report(user):
    payload = load_payload(IssueReportSchema, json_body())
    data = {
        "subject": payload["subject"],
        "category": payload.get("category") or SuggestionCategory.OTHER,
        "message": payload["message"],
    }
    return communication_service.create_suggestion(
        data, author=user, parent=None, source=SuggestionSource.STUDENT
    )
