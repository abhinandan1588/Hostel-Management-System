"""Password policy, token generation and request metadata helpers."""

import hashlib
import re
import secrets

from flask import request

PASSWORD_MIN_LENGTH = 8
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
PHONE_RE = re.compile(r"^\+?[0-9][0-9\s\-]{6,19}$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,80}$")
STUDENT_CODE_RE = re.compile(r"^[A-Za-z0-9/_-]{3,50}$")


def validate_password_strength(password):
    """Return a list of human-readable problems (empty list == acceptable)."""
    problems = []
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        problems.append(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long.")
    if password and not re.search(r"[A-Za-z]", password):
        problems.append("Password must contain at least one letter.")
    if password and not re.search(r"\d", password):
        problems.append("Password must contain at least one number.")
    return problems


def is_valid_email(value):
    return bool(value and EMAIL_RE.match(value.strip()))


def is_valid_phone(value):
    return bool(value and PHONE_RE.match(value.strip()))


def normalize_email(value):
    return (value or "").strip().lower()


def normalize_phone(value):
    if not value:
        return None
    cleaned = re.sub(r"[\s\-()]", "", str(value).strip())
    return cleaned or None


def generate_reset_token():
    """Return ``(plain_token, sha256_hash)``. Only the hash is persisted."""
    token = secrets.token_urlsafe(48)
    return token, hash_token(token)


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def user_agent():
    return (request.headers.get("User-Agent") or "")[:255]


def apply_security_headers(response):
    """Conservative hardening headers for a JSON API."""
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-XSS-Protection", "0")
    response.headers.setdefault(
        "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response
