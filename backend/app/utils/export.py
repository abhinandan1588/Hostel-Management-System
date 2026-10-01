"""CSV and PDF export helpers used by the reports API."""

import csv
import io
from datetime import datetime, timezone

from flask import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _stamp():
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def _safe_filename(name):
    keep = "-_.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    cleaned = "".join(ch if ch in keep else "-" for ch in name)
    return cleaned.strip("-") or "report"


def csv_response(filename, headers, rows):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(["" if value is None else value for value in row])
    payload = buffer.getvalue()
    download_name = f"{_safe_filename(filename)}-{_stamp()}.csv"
    return Response(
        payload,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{download_name}"',
            "Cache-Control": "no-store",
        },
    )


def pdf_response(filename, title, headers, rows, subtitle=None):
    buffer = io.BytesIO()
    page_size = landscape(A4) if len(headers) > 6 else A4
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        title=title,
        author="Hostel Management System",
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"])]
    if subtitle:
        story.append(Paragraph(subtitle, styles["Normal"]))
    story.append(
        Paragraph(
            f"Generated {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}",
            styles["Italic"],
        )
    )
    story.append(Spacer(1, 8 * mm))

    cell_style = styles["BodyText"].clone("cell")
    cell_style.fontSize = 8
    cell_style.leading = 10

    header_style = styles["BodyText"].clone("header")
    header_style.fontSize = 8
    header_style.leading = 10
    header_style.textColor = colors.white

    if rows:
        table_data = [[Paragraph(str(h), header_style) for h in headers]]
        for row in rows:
            table_data.append(
                [Paragraph("" if v is None else str(v), cell_style) for v in row]
            )
        table = Table(table_data, repeatRows=1, hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4338ca")),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c7d2fe")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef2ff")]),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(table)
    else:
        story.append(Paragraph("No records found for the selected filters.", styles["Normal"]))

    doc.build(story)
    download_name = f"{_safe_filename(filename)}-{_stamp()}.pdf"
    return Response(
        buffer.getvalue(),
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{download_name}"',
            "Cache-Control": "no-store",
        },
    )
