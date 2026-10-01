"""Hostel physical structure: buildings -> floors -> rooms -> beds."""

from ..extensions import db
from .base import TimestampMixin


class Room(TimestampMixin, db.Model):
    __tablename__ = "rooms"
    __table_args__ = (
        db.UniqueConstraint("building", "room_number", name="uq_rooms_building_room_number"),
        db.CheckConstraint("capacity > 0", name="capacity_positive"),
    )

    id = db.Column(db.Integer, primary_key=True)
    building = db.Column(db.String(60), nullable=False, default="Main Building", index=True)
    floor = db.Column(db.Integer, nullable=False, default=1)
    room_number = db.Column(db.String(30), nullable=False, index=True)
    capacity = db.Column(db.Integer, nullable=False, default=4)
    room_type = db.Column(db.String(40), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    beds = db.relationship(
        "Bed",
        back_populates="room",
        cascade="all, delete-orphan",
        order_by="Bed.bed_number",
    )

    @property
    def occupied_beds(self):
        return sum(1 for bed in self.beds if bed.student is not None)

    @property
    def available_beds(self):
        return sum(1 for bed in self.beds if bed.is_active and bed.student is None)

    @property
    def label(self):
        return f"{self.building} / Room {self.room_number}"

    def to_dict(self, include_beds=False):
        data = {
            "id": self.id,
            "building": self.building,
            "floor": self.floor,
            "room_number": self.room_number,
            "label": self.label,
            "capacity": self.capacity,
            "room_type": self.room_type,
            "notes": self.notes,
            "is_active": self.is_active,
            "total_beds": len(self.beds),
            "occupied_beds": self.occupied_beds,
            "available_beds": self.available_beds,
            **self.timestamps,
        }
        if include_beds:
            data["beds"] = [bed.to_dict() for bed in self.beds]
        return data


class Bed(TimestampMixin, db.Model):
    __tablename__ = "beds"
    __table_args__ = (
        db.UniqueConstraint("room_id", "bed_number", name="uq_beds_room_id_bed_number"),
    )

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(
        db.Integer, db.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bed_number = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    notes = db.Column(db.String(255), nullable=True)

    room = db.relationship("Room", back_populates="beds")
    # One bed holds at most one student (students.bed_id is unique).
    student = db.relationship("Student", back_populates="bed", uselist=False)

    @property
    def is_occupied(self):
        return self.student is not None

    def to_dict(self, include_student=True):
        data = {
            "id": self.id,
            "room_id": self.room_id,
            "bed_number": self.bed_number,
            "is_active": self.is_active,
            "notes": self.notes,
            "is_occupied": self.is_occupied,
            "room": {
                "id": self.room.id,
                "building": self.room.building,
                "floor": self.room.floor,
                "room_number": self.room.room_number,
                "label": self.room.label,
            }
            if self.room
            else None,
        }
        if include_student:
            data["student"] = (
                {
                    "id": self.student.id,
                    "full_name": self.student.full_name,
                    "student_code": self.student.student_code,
                    "profile_photo": self.student.profile_photo,
                }
                if self.student
                else None
            )
        return data
