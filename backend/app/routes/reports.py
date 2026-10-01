"""Report generation and export: /api/reports/*"""

from flask import Blueprint, request

from ..constants import AuditAction
from ..decorators import admin_required, current_user
from ..services import report_service
from ..utils.audit import record_audit
from ..utils.dates import parse_date
from ..utils.errors import ValidationFailed
from ..utils.export import csv_response, pdf_response
from ..utils.request_helpers import bool_arg, int_arg
from ..utils.responses import success

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _params():
    return {
        "date": parse_date(request.args.get("date"), "date", default=None),
        "start_date": parse_date(request.args.get("start_date"), "start_date", default=None),
        "end_date": parse_date(request.args.get("end_date"), "end_date", default=None),
        "year": int_arg("year"),
        "month": int_arg("month"),
        "student_id": request.args.get("student_id"),
        "student_class": request.args.get("student_class"),
        "status": request.args.get("status"),
        "verification_status": request.args.get("verification_status"),
        "include_inactive": bool_arg("include_inactive"),
    }


@reports_bp.get("")
@admin_required
def catalogue():
    return success(
        {
            "reports": [
                {"type": "daily-attendance", "name": "Daily Attendance Report"},
                {"type": "monthly-attendance", "name": "Monthly Attendance Report"},
                {"type": "student-progress", "name": "Student Progress Report"},
                {"type": "health", "name": "Health Report"},
                {"type": "meals", "name": "Meal Report"},
                {"type": "school-attendance", "name": "School Attendance Report"},
                {"type": "parent-list", "name": "Parent List"},
                {"type": "student-list", "name": "Student List"},
                {"type": "hostel-occupancy", "name": "Hostel Occupancy Report"},
            ],
            "formats": ["json", "csv", "pdf"],
        }
    )


@reports_bp.get("/<report_type>")
@admin_required
def generate(report_type):
    """Render any report as JSON (default), CSV or PDF via ``?format=``."""
    export_format = (request.args.get("format") or "json").lower()
    if export_format not in ("json", "csv", "pdf"):
        raise ValidationFailed("Format must be one of: json, csv, pdf.")

    title, headers, rows, extra = report_service.build(report_type, _params())

    if export_format == "json":
        return success(
            {
                "type": report_type,
                "title": title,
                "headers": headers,
                "rows": rows,
                "row_count": len(rows),
                **(extra or {}),
            }
        )

    record_audit(
        AuditAction.REPORT_EXPORTED,
        actor=current_user(),
        entity_type="report",
        description=f"Exported '{title}' as {export_format.upper()} ({len(rows)} rows)",
        commit=True,
    )
    if export_format == "csv":
        return csv_response(report_type, headers, rows)
    return pdf_response(report_type, title, headers, rows)
