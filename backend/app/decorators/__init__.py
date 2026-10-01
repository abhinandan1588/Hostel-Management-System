"""Reusable route decorators."""

from .auth import (
    accessible_student_ids,
    admin_required,
    auth_required,
    authorize_parent_access,
    authorize_student_access,
    current_parent,
    current_student,
    current_user,
    parent_required,
    role_required,
    student_required,
    super_admin_required,
)

__all__ = [
    "auth_required",
    "admin_required",
    "super_admin_required",
    "parent_required",
    "student_required",
    "role_required",
    "current_user",
    "current_parent",
    "current_student",
    "authorize_student_access",
    "authorize_parent_access",
    "accessible_student_ids",
]
