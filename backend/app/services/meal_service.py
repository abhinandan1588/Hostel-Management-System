"""Meal records and meal photo gallery."""

from datetime import date

from sqlalchemy import func, select

from ..constants import AuditAction, MealType, NotificationPriority, NotificationType
from ..extensions import db
from ..models import Meal, MealPhoto, Student
from ..utils.audit import record_audit
from ..utils.errors import NotFound
from ..utils.storage import delete_file, save_image
from . import notification_service

MEAL_ORDER = [MealType.BREAKFAST, MealType.LUNCH, MealType.EVENING_SNACK, MealType.DINNER]
MEAL_LABELS = {
    MealType.BREAKFAST: "Breakfast",
    MealType.LUNCH: "Lunch",
    MealType.EVENING_SNACK: "Evening Snack",
    MealType.DINNER: "Dinner",
}


def get_meal(meal_id):
    meal = db.session.get(Meal, int(meal_id))
    if meal is None:
        raise NotFound("Meal record not found")
    return meal


def list_meals(start_date=None, end_date=None, meal_type=None):
    query = Meal.query
    if start_date:
        query = query.filter(Meal.date >= start_date)
    if end_date:
        query = query.filter(Meal.date <= end_date)
    coerced = MealType.coerce(meal_type)
    if coerced:
        query = query.filter(Meal.meal_type == coerced)
    meals = query.order_by(Meal.date.desc(), Meal.served_at.asc()).all()
    return [meal.to_dict() for meal in meals]


def day_menu(on_date=None):
    """All four meal slots for a day, including ones not yet recorded."""
    on_date = on_date or date.today()
    meals = {
        meal.meal_type: meal for meal in Meal.query.filter(Meal.date == on_date).all()
    }
    slots = []
    for meal_type in MEAL_ORDER:
        meal = meals.get(meal_type)
        slots.append(
            {
                "meal_type": meal_type.value,
                "label": MEAL_LABELS[meal_type],
                "recorded": meal is not None,
                "meal": meal.to_dict() if meal else None,
            }
        )
    return {"date": on_date.isoformat(), "slots": slots}


def create_or_update_meal(data, actor=None):
    on_date = data.get("date") or date.today()
    meal_type = data["meal_type"]
    meal = db.session.execute(
        select(Meal).where(Meal.date == on_date, Meal.meal_type == meal_type)
    ).scalars().first()

    is_new = meal is None
    if meal is None:
        meal = Meal(date=on_date, meal_type=meal_type)
        db.session.add(meal)

    meal.name = data.get("name") or MEAL_LABELS.get(meal_type, meal_type.value.title())
    if "food_items" in data:
        meal.food_items = "\n".join(data.get("food_items") or [])
    if "served_at" in data:
        meal.served_at = data.get("served_at")
    if "remarks" in data:
        meal.remarks = data.get("remarks")
    meal.created_by_id = getattr(actor, "id", None)
    db.session.flush()

    record_audit(
        AuditAction.MEAL_UPLOADED if is_new else AuditAction.MEAL_UPDATED,
        actor=actor,
        entity_type="meal",
        entity_id=meal.id,
        description=f"{'Recorded' if is_new else 'Updated'} {MEAL_LABELS.get(meal_type)} "
        f"for {on_date}",
    )
    db.session.commit()
    return meal


def update_meal(meal, data, actor=None):
    if "name" in data:
        meal.name = data["name"]
    if "food_items" in data:
        meal.food_items = "\n".join(data.get("food_items") or [])
    if "served_at" in data:
        meal.served_at = data["served_at"]
    if "remarks" in data:
        meal.remarks = data["remarks"]
    record_audit(
        AuditAction.MEAL_UPDATED,
        actor=actor,
        entity_type="meal",
        entity_id=meal.id,
        description=f"Updated {meal.meal_type.value} for {meal.date}",
    )
    db.session.commit()
    return meal


def delete_meal(meal, actor=None):
    paths = [photo.file_path for photo in meal.photos]
    description = f"Deleted {meal.meal_type.value} record for {meal.date}"
    meal_id = meal.id
    db.session.delete(meal)
    record_audit(
        AuditAction.MEAL_REMOVED,
        actor=actor,
        entity_type="meal",
        entity_id=meal_id,
        description=description,
    )
    db.session.commit()
    for path in paths:
        delete_file(path)
    return True


def add_photos(meal, files, actor=None, caption=None, notify=True):
    """Persist one or more validated, compressed meal photos."""
    saved = []
    for file_storage in files:
        if file_storage is None or not getattr(file_storage, "filename", ""):
            continue
        relative_path = save_image(file_storage, "meals", field="photos")
        photo = MealPhoto(
            meal_id=meal.id,
            file_path=relative_path,
            caption=caption,
            uploaded_by_id=getattr(actor, "id", None),
        )
        db.session.add(photo)
        saved.append(photo)

    if not saved:
        raise NotFound("No valid image files were uploaded.")

    record_audit(
        AuditAction.MEAL_UPLOADED,
        actor=actor,
        entity_type="meal",
        entity_id=meal.id,
        description=f"Uploaded {len(saved)} photo(s) for {meal.meal_type.value} on {meal.date}",
    )
    db.session.flush()

    if notify and meal.date == date.today():
        _notify_meal_photos(meal, len(saved), actor)

    db.session.commit()
    return saved


def _notify_meal_photos(meal, photo_count, actor=None):
    label = MEAL_LABELS.get(meal.meal_type, meal.meal_type.value.title())
    students = Student.query.filter(Student.is_active.is_(True)).all()
    for student in students:
        notification_service.notify_student_guardians(
            student,
            NotificationType.MEAL_UPDATE,
            f"Today's {label} photos",
            f"{photo_count} photo(s) of today's {label.lower()} have been added.",
            priority=NotificationPriority.LOW,
            link="/parent/meals",
            created_by=actor,
            include_student_account=False,
        )


def delete_photo(photo_id, actor=None):
    photo = db.session.get(MealPhoto, int(photo_id))
    if photo is None:
        raise NotFound("Meal photo not found")
    path = photo.file_path
    meal_id = photo.meal_id
    db.session.delete(photo)
    record_audit(
        AuditAction.MEAL_UPDATED,
        actor=actor,
        entity_type="meal",
        entity_id=meal_id,
        description="Deleted a meal photo",
    )
    db.session.commit()
    delete_file(path)
    return True


def stats(start_date, end_date):
    rows = db.session.execute(
        select(Meal.meal_type, func.count(Meal.id))
        .where(Meal.date >= start_date, Meal.date <= end_date)
        .group_by(Meal.meal_type)
    ).all()
    counts = {meal_type.value: 0 for meal_type in MealType}
    for meal_type, total in rows:
        counts[meal_type.value] = total
    photo_total = db.session.execute(
        select(func.count(MealPhoto.id))
        .join(Meal, Meal.id == MealPhoto.meal_id)
        .where(Meal.date >= start_date, Meal.date <= end_date)
    ).scalar() or 0
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "counts": counts,
        "total_meals": sum(counts.values()),
        "total_photos": photo_total,
    }
