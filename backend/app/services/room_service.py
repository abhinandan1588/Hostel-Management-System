"""Hostel room / bed management and occupancy statistics."""

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..constants import AuditAction
from ..extensions import db
from ..models import Bed, Room, Student
from ..utils.audit import record_audit
from ..utils.errors import BusinessRuleViolation, Conflict, NotFound


def get_room(room_id):
    room = db.session.get(Room, int(room_id))
    if room is None:
        raise NotFound("Room not found")
    return room


def get_bed(bed_id):
    bed = db.session.get(Bed, int(bed_id))
    if bed is None:
        raise NotFound("Bed not found")
    return bed


def list_rooms(filters=None):
    filters = filters or {}
    query = Room.query.options(joinedload(Room.beds).joinedload(Bed.student))
    if filters.get("building"):
        query = query.filter(Room.building == filters["building"])
    if filters.get("floor") is not None:
        query = query.filter(Room.floor == int(filters["floor"]))
    if filters.get("q"):
        pattern = f"%{filters['q'].lower()}%"
        query = query.filter(
            func.lower(Room.room_number).like(pattern) | func.lower(Room.building).like(pattern)
        )
    if filters.get("only_active", True):
        query = query.filter(Room.is_active.is_(True))
    rooms = query.order_by(Room.building, Room.floor, Room.room_number).all()
    return [room.to_dict(include_beds=True) for room in rooms]


def building_tree():
    """Nested Building -> Floor -> Room -> Bed structure for the UI."""
    rooms = (
        Room.query.options(joinedload(Room.beds).joinedload(Bed.student))
        .order_by(Room.building, Room.floor, Room.room_number)
        .all()
    )
    buildings = {}
    for room in rooms:
        building = buildings.setdefault(
            room.building, {"building": room.building, "floors": {}}
        )
        floor = building["floors"].setdefault(room.floor, {"floor": room.floor, "rooms": []})
        floor["rooms"].append(room.to_dict(include_beds=True))
    return [
        {
            "building": name,
            "floors": sorted(
                (floor for floor in data["floors"].values()), key=lambda f: f["floor"]
            ),
        }
        for name, data in sorted(buildings.items())
    ]


def create_room(data, actor=None):
    building = data.get("building") or "Main Building"
    exists = db.session.execute(
        select(Room.id).where(Room.building == building, Room.room_number == data["room_number"])
    ).scalar()
    if exists:
        raise Conflict(f"Room {data['room_number']} already exists in {building}.")

    room = Room(
        building=building,
        floor=data.get("floor", 1),
        room_number=data["room_number"],
        capacity=data.get("capacity", 4),
        room_type=data.get("room_type"),
        notes=data.get("notes"),
        is_active=data.get("is_active", True),
    )
    db.session.add(room)
    db.session.flush()

    bed_count = data.get("bed_count")
    if bed_count is None:
        bed_count = room.capacity
    for index in range(1, int(bed_count) + 1):
        db.session.add(Bed(room_id=room.id, bed_number=str(index)))

    record_audit(
        AuditAction.ROOM_CREATED,
        actor=actor,
        entity_type="room",
        entity_id=room.id,
        description=f"Created {room.label} with {bed_count} bed(s)",
    )
    db.session.commit()
    return room


def update_room(room, data, actor=None):
    for field in ("building", "floor", "room_number", "capacity", "room_type", "notes", "is_active"):
        if field in data and data[field] is not None:
            setattr(room, field, data[field])
    record_audit(
        AuditAction.ROOM_UPDATED,
        actor=actor,
        entity_type="room",
        entity_id=room.id,
        description=f"Updated {room.label}",
    )
    db.session.commit()
    return room


def delete_room(room, actor=None):
    occupied = room.occupied_beds
    if occupied:
        raise BusinessRuleViolation(
            f"{room.label} still has {occupied} student(s) assigned. "
            "Move them to another room first."
        )
    label = room.label
    db.session.delete(room)
    record_audit(
        AuditAction.ROOM_REMOVED,
        actor=actor,
        entity_type="room",
        entity_id=room.id,
        description=f"Removed {label}",
    )
    db.session.commit()
    return True


def add_bed(data, actor=None):
    room = get_room(data["room_id"])
    exists = db.session.execute(
        select(Bed.id).where(Bed.room_id == room.id, Bed.bed_number == data["bed_number"])
    ).scalar()
    if exists:
        raise Conflict(f"Bed {data['bed_number']} already exists in {room.label}.")
    bed = Bed(
        room_id=room.id,
        bed_number=data["bed_number"],
        notes=data.get("notes"),
        is_active=data.get("is_active", True),
    )
    db.session.add(bed)
    record_audit(
        AuditAction.ROOM_UPDATED,
        actor=actor,
        entity_type="room",
        entity_id=room.id,
        description=f"Added bed {bed.bed_number} to {room.label}",
    )
    db.session.commit()
    return bed


def update_bed(bed, data, actor=None):
    if "bed_number" in data and data["bed_number"]:
        bed.bed_number = data["bed_number"]
    if "notes" in data:
        bed.notes = data["notes"]
    if "is_active" in data:
        if not data["is_active"] and bed.student is not None:
            raise BusinessRuleViolation(
                "Cannot deactivate an occupied bed. Move the student first."
            )
        bed.is_active = bool(data["is_active"])
    record_audit(
        AuditAction.ROOM_UPDATED,
        actor=actor,
        entity_type="bed",
        entity_id=bed.id,
        description=f"Updated bed {bed.bed_number}",
    )
    db.session.commit()
    return bed


def delete_bed(bed, actor=None):
    if bed.student is not None:
        raise BusinessRuleViolation("This bed is occupied. Move the student first.")
    room_label = bed.room.label if bed.room else ""
    number = bed.bed_number
    db.session.delete(bed)
    record_audit(
        AuditAction.ROOM_UPDATED,
        actor=actor,
        entity_type="bed",
        entity_id=bed.id,
        description=f"Removed bed {number} from {room_label}",
    )
    db.session.commit()
    return True


def available_beds():
    occupied = select(Student.bed_id).where(Student.bed_id.isnot(None))
    beds = (
        Bed.query.options(joinedload(Bed.room))
        .filter(Bed.is_active.is_(True), ~Bed.id.in_(occupied))
        .join(Room, Room.id == Bed.room_id)
        .order_by(Room.building, Room.room_number, Bed.bed_number)
        .all()
    )
    return [bed.to_dict(include_student=False) for bed in beds]


def occupancy_summary():
    total_rooms = db.session.execute(
        select(func.count(Room.id)).where(Room.is_active.is_(True))
    ).scalar() or 0
    total_beds = db.session.execute(
        select(func.count(Bed.id)).where(Bed.is_active.is_(True))
    ).scalar() or 0
    occupied_beds = db.session.execute(
        select(func.count(Student.id)).where(
            Student.bed_id.isnot(None), Student.is_active.is_(True)
        )
    ).scalar() or 0
    unassigned_students = db.session.execute(
        select(func.count(Student.id)).where(
            Student.bed_id.is_(None), Student.is_active.is_(True)
        )
    ).scalar() or 0
    return {
        "total_rooms": total_rooms,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": max(total_beds - occupied_beds, 0),
        "unassigned_students": unassigned_students,
        "occupancy_rate": round((occupied_beds / total_beds) * 100, 1) if total_beds else 0.0,
    }


def occupancy_by_building():
    rows = db.session.execute(
        select(
            Room.building,
            func.count(Bed.id).label("beds"),
        )
        .join(Bed, Bed.room_id == Room.id)
        .where(Room.is_active.is_(True), Bed.is_active.is_(True))
        .group_by(Room.building)
        .order_by(Room.building)
    ).all()
    occupied_rows = db.session.execute(
        select(Room.building, func.count(Student.id))
        .join(Bed, Bed.room_id == Room.id)
        .join(Student, Student.bed_id == Bed.id)
        .where(Student.is_active.is_(True))
        .group_by(Room.building)
    ).all()
    occupied_map = {row[0]: row[1] for row in occupied_rows}
    return [
        {
            "building": row[0],
            "total_beds": row[1],
            "occupied": occupied_map.get(row[0], 0),
            "available": max(row[1] - occupied_map.get(row[0], 0), 0),
        }
        for row in rows
    ]
