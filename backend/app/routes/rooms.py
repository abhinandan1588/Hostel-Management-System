"""Hostel room and bed endpoints: /api/rooms/*, /api/beds/*"""

from flask import Blueprint, request

from ..decorators import admin_required, current_user
from ..schemas import BedSchema, RoomSchema, load_payload
from ..services import room_service
from ..utils.request_helpers import bool_arg, json_body
from ..utils.responses import created, success

rooms_bp = Blueprint("rooms", __name__, url_prefix="/api/rooms")
beds_bp = Blueprint("beds", __name__, url_prefix="/api/beds")


@rooms_bp.get("")
@admin_required
def list_rooms():
    filters = {
        "building": request.args.get("building"),
        "floor": request.args.get("floor"),
        "q": request.args.get("q"),
        "only_active": bool_arg("only_active", True),
    }
    return success(
        {
            "rooms": room_service.list_rooms(filters),
            "summary": room_service.occupancy_summary(),
        }
    )


@rooms_bp.get("/tree")
@admin_required
def room_tree():
    """Building -> Floor -> Room -> Bed hierarchy."""
    return success(
        {
            "buildings": room_service.building_tree(),
            "summary": room_service.occupancy_summary(),
        }
    )


@rooms_bp.get("/summary")
@admin_required
def summary():
    return success(
        {
            "summary": room_service.occupancy_summary(),
            "by_building": room_service.occupancy_by_building(),
        }
    )


@rooms_bp.post("")
@admin_required
def create_room():
    payload = load_payload(RoomSchema, json_body())
    room = room_service.create_room(payload, actor=current_user())
    return created(room.to_dict(include_beds=True), message="Room created successfully")


@rooms_bp.get("/<int:room_id>")
@admin_required
def get_room(room_id):
    room = room_service.get_room(room_id)
    return success(room.to_dict(include_beds=True))


@rooms_bp.put("/<int:room_id>")
@rooms_bp.patch("/<int:room_id>")
@admin_required
def update_room(room_id):
    room = room_service.get_room(room_id)
    payload = load_payload(RoomSchema, json_body(), partial=True)
    room_service.update_room(room, payload, actor=current_user())
    return success(room.to_dict(include_beds=True), message="Room updated successfully")


@rooms_bp.delete("/<int:room_id>")
@admin_required
def delete_room(room_id):
    room = room_service.get_room(room_id)
    room_service.delete_room(room, actor=current_user())
    return success(message="Room removed")


@beds_bp.get("")
@admin_required
def list_beds():
    if bool_arg("available_only"):
        return success(room_service.available_beds())
    rooms = room_service.list_rooms({"only_active": False})
    beds = [bed for room in rooms for bed in room["beds"]]
    return success(beds)


@beds_bp.post("")
@admin_required
def create_bed():
    payload = load_payload(BedSchema, json_body())
    bed = room_service.add_bed(payload, actor=current_user())
    return created(bed.to_dict(), message="Bed added successfully")


@beds_bp.patch("/<int:bed_id>")
@admin_required
def update_bed(bed_id):
    bed = room_service.get_bed(bed_id)
    payload = load_payload(BedSchema, json_body(), partial=True)
    room_service.update_bed(bed, payload, actor=current_user())
    return success(bed.to_dict(), message="Bed updated successfully")


@beds_bp.delete("/<int:bed_id>")
@admin_required
def delete_bed(bed_id):
    bed = room_service.get_bed(bed_id)
    room_service.delete_bed(bed, actor=current_user())
    return success(message="Bed removed")
