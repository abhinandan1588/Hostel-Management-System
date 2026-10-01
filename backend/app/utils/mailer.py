"""Email delivery.

Mail is opt-in (``MAIL_ENABLED``). When disabled, messages are logged instead of
sent so local development and tests never need an SMTP server. Delivery
failures are swallowed - a broken mail server must not fail an API request.
"""

import logging

from flask import current_app
from flask_mail import Message

from ..extensions import mail

logger = logging.getLogger(__name__)


def send_email(subject, recipients, body, html=None):
    recipients = [r for r in (recipients or []) if r]
    if not recipients:
        return False
    if not current_app.config.get("MAIL_ENABLED"):
        logger.info("[mail suppressed] to=%s subject=%s", recipients, subject)
        return False
    try:
        message = Message(subject=subject, recipients=recipients, body=body, html=html)
        mail.send(message)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", recipients)
        return False


def send_password_reset_email(user, token):
    base = current_app.config.get("FRONTEND_BASE_URL", "").rstrip("/")
    link = f"{base}/reset-password?token={token}"
    minutes = current_app.config.get("PASSWORD_RESET_TOKEN_MINUTES", 60)
    body = (
        f"Hello {user.full_name},\n\n"
        "We received a request to reset your Hostel Management System password.\n\n"
        f"Reset link (valid for {minutes} minutes):\n{link}\n\n"
        "If you did not request this, you can safely ignore this email.\n"
    )
    return send_email("Reset your password", [user.email], body)


def send_account_status_email(user, status_text, note=None):
    body = f"Hello {user.full_name},\n\nYour account status is now: {status_text}.\n"
    if note:
        body += f"\nNote: {note}\n"
    return send_email("Account status update", [user.email], body)


def send_notification_email(user, title, message):
    body = f"Hello {user.full_name},\n\n{title}\n\n{message}\n"
    return send_email(title, [user.email], body)
