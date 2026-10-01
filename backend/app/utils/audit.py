"""Audit trail writer.

Every state-changing administrative action funnels through :func:`record_audit`
so the ``audit_logs`` table stays a reliable accountability record.
"""

import logging

from ..extensions import db
from ..models import AuditLog
from .security import client_ip, user_agent

logger = logging.getLogger(__name__)


def record_audit(
    action,
    actor=None,
    entity_type=None,
    entity_id=None,
    affected_user=None,
    description=None,
    commit=False,
):
    try:
        entry = AuditLog(
            admin_id=getattr(actor, "id", None),
            admin_name=getattr(actor, "full_name", None),
            action=str(getattr(action, "value", action)),
            entity_type=entity_type,
            entity_id=entity_id,
            affected_user_id=getattr(affected_user, "id", None),
            affected_user_name=getattr(affected_user, "full_name", None),
            description=description,
            ip_address=_safe(client_ip),
            user_agent=_safe(user_agent),
        )
        db.session.add(entry)
        if commit:
            db.session.commit()
        return entry
    except Exception:  # auditing must never break the business operation
        logger.exception("Failed to write audit log for action=%s", action)
        return None


def _safe(fn):
    try:
        return fn()
    except RuntimeError:  # outside a request context (CLI / seed script)
        return None
