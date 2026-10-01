"""Meal endpoints: /api/meals/*

Meals are hostel-wide, so any authenticated user may read them. Only ADMIN can
record meals or upload photos.
"""

from datetime import date

from flask import Blueprint, request

from ..decorators import admin_required, auth_required, current_user
from ..schemas import MealSchema, MealUpdateSchema, load_payload
from ..services import meal_service
from ..utils.dates import parse_date, resolve_period
from ..utils.request_helpers import form_body, json_body
from ..utils.responses import created, success

meals_bp = Blueprint("meals", __name__, url_prefix="/api/meals")


@meals_bp.get("")
@auth_required
def list_meals():
    start, end = resolve_period(request.args, default_days=7)
    return success(meal_service.list_meals(start, end, request.args.get("meal_type")))


@meals_bp.get("/today")
@auth_required
def today_menu():
    return success(meal_service.day_menu(date.today()))


@meals_bp.get("/stats")
@admin_required
def stats():
    start, end = resolve_period(request.args, default_days=30)
    return success(meal_service.stats(start, end))


@meals_bp.post("")
@admin_required
def create_meal():
    """Accepts JSON or multipart (fields + optional ``photos`` files)."""
    body = form_body() if request.files else json_body()
    payload = load_payload(MealSchema, body)
    meal = meal_service.create_or_update_meal(payload, actor=current_user())
    files = request.files.getlist("photos") if request.files else []
    if files:
        meal_service.add_photos(meal, files, actor=current_user())
    return created(meal.to_dict(), message="Meal saved successfully")


@meals_bp.get("/<meal_date>")
@auth_required
def meals_for_date(meal_date):
    on_date = parse_date(meal_date, "date", required=True)
    return success(meal_service.day_menu(on_date))


@meals_bp.patch("/id/<int:meal_id>")
@admin_required
def update_meal(meal_id):
    meal = meal_service.get_meal(meal_id)
    payload = load_payload(MealUpdateSchema, json_body(), partial=True)
    meal_service.update_meal(meal, payload, actor=current_user())
    return success(meal.to_dict(), message="Meal updated successfully")


@meals_bp.delete("/id/<int:meal_id>")
@admin_required
def delete_meal(meal_id):
    meal = meal_service.get_meal(meal_id)
    meal_service.delete_meal(meal, actor=current_user())
    return success(message="Meal record deleted")


@meals_bp.post("/id/<int:meal_id>/photos")
@admin_required
def upload_photos(meal_id):
    meal = meal_service.get_meal(meal_id)
    files = request.files.getlist("photos") or [request.files.get("photo")]
    saved = meal_service.add_photos(
        meal, files, actor=current_user(), caption=request.form.get("caption")
    )
    return created(
        {"meal": meal.to_dict(), "uploaded": len(saved)},
        message=f"{len(saved)} photo(s) uploaded",
    )


@meals_bp.delete("/photos/<int:photo_id>")
@admin_required
def delete_photo(photo_id):
    meal_service.delete_photo(photo_id, actor=current_user())
    return success(message="Photo deleted")
