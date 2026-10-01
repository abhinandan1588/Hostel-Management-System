"""Pluggable file storage.

``LocalStorage`` is used during development; the ``StorageBackend`` interface is
small on purpose so an S3/GCS implementation can be dropped in for production
without touching any service code (set ``STORAGE_BACKEND`` in the environment).
"""

import io
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

from flask import current_app
from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename

from .errors import ValidationFailed

# Pillow needs an explicit save format per extension.
_FORMAT_BY_EXT = {
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
    "gif": "GIF",
}


def _extension(filename):
    return Path(filename or "").suffix.lower().lstrip(".")


def sniff_image_format(data):
    """Detect the real image type from magic bytes.

    Replaces the removed stdlib ``imghdr`` module (dropped in Python 3.13).
    Returns a lowercase format name or ``None`` when the bytes are not a
    recognised image.
    """
    if not data or len(data) < 12:
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:2] in (b"MM", b"II") and data[2:4] in (b"\x00\x2a", b"\x2a\x00"):
        return "tiff"
    if data[:2] == b"BM":
        return "bmp"
    return None


def generate_stored_name(extension):
    """Server-generated filename - user input is never used for the path."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"{stamp}-{secrets.token_hex(8)}.{extension}"


class StorageBackend:
    def save(self, data, folder, extension):  # pragma: no cover - interface
        raise NotImplementedError

    def delete(self, relative_path):  # pragma: no cover - interface
        raise NotImplementedError

    def url(self, relative_path):  # pragma: no cover - interface
        raise NotImplementedError


class LocalStorage(StorageBackend):
    def __init__(self, root, public_base_url=""):
        self.root = Path(root)
        self.public_base_url = public_base_url.rstrip("/")

    def save(self, data, folder, extension):
        safe_folder = secure_filename(folder) or "misc"
        target_dir = self.root / safe_folder
        target_dir.mkdir(parents=True, exist_ok=True)
        name = generate_stored_name(extension)
        path = target_dir / name
        with open(path, "wb") as handle:
            handle.write(data)
        return f"{safe_folder}/{name}"

    def delete(self, relative_path):
        if not relative_path:
            return False
        candidate = (self.root / relative_path).resolve()
        try:
            candidate.relative_to(self.root.resolve())
        except ValueError:
            return False  # refuse to touch anything outside the upload root
        if candidate.is_file():
            candidate.unlink()
            return True
        return False

    def url(self, relative_path):
        if not relative_path:
            return None
        if self.public_base_url:
            return f"{self.public_base_url}/{relative_path}"
        return f"/api/media/{relative_path}"


def get_storage():
    backend = current_app.extensions.get("hms_storage")
    if backend is None:
        backend = LocalStorage(
            current_app.config["UPLOAD_FOLDER"],
            current_app.config.get("PUBLIC_MEDIA_BASE_URL", ""),
        )
        current_app.extensions["hms_storage"] = backend
    return backend


def _validate_size(data, field):
    limit = current_app.config.get("MAX_CONTENT_LENGTH", 8 * 1024 * 1024)
    if len(data) == 0:
        raise ValidationFailed("Uploaded file is empty.", errors={field: ["File is empty."]})
    if len(data) > limit:
        mb = round(limit / (1024 * 1024), 1)
        raise ValidationFailed(
            f"File is too large. Maximum size is {mb} MB.",
            errors={field: [f"Maximum size is {mb} MB."]},
        )


def save_image(file_storage, folder, field="file", compress=True):
    """Validate, normalise and persist an uploaded image.

    Server-side checks: extension whitelist, real image sniffing (never trust
    the client's content-type), size limit. Images are re-encoded which also
    strips any embedded payload/EXIF data.
    """
    if file_storage is None or not getattr(file_storage, "filename", ""):
        raise ValidationFailed("No file was uploaded.", errors={field: ["A file is required."]})

    allowed = current_app.config["ALLOWED_IMAGE_EXTENSIONS"]
    extension = _extension(file_storage.filename)
    if extension not in allowed:
        raise ValidationFailed(
            f"Unsupported image type. Allowed: {', '.join(sorted(allowed))}.",
            errors={field: ["Unsupported file type."]},
        )

    raw = file_storage.read()
    _validate_size(raw, field)

    sniffed = sniff_image_format(raw)
    if sniffed is None:
        raise ValidationFailed(
            "The uploaded file is not a valid image.", errors={field: ["Invalid image data."]}
        )

    if not compress:
        return get_storage().save(raw, folder, extension)

    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            save_format = _FORMAT_BY_EXT.get(extension, "JPEG")
            if save_format == "JPEG" and image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            max_dimension = current_app.config.get("IMAGE_MAX_DIMENSION", 1600)
            if max(image.size) > max_dimension:
                image.thumbnail((max_dimension, max_dimension), Image.LANCZOS)
            buffer = io.BytesIO()
            save_kwargs = {}
            if save_format in ("JPEG", "WEBP"):
                save_kwargs["quality"] = current_app.config.get("IMAGE_QUALITY", 82)
                save_kwargs["optimize"] = True
            image.save(buffer, format=save_format, **save_kwargs)
            payload = buffer.getvalue()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationFailed(
            "The uploaded image could not be processed.", errors={field: ["Invalid image."]}
        )

    return get_storage().save(payload, folder, extension)


def save_document(file_storage, folder, field="document"):
    """Persist an identity document (PDF or image)."""
    if file_storage is None or not getattr(file_storage, "filename", ""):
        raise ValidationFailed("No file was uploaded.", errors={field: ["A file is required."]})

    allowed = current_app.config["ALLOWED_DOCUMENT_EXTENSIONS"]
    extension = _extension(file_storage.filename)
    if extension not in allowed:
        raise ValidationFailed(
            f"Unsupported document type. Allowed: {', '.join(sorted(allowed))}.",
            errors={field: ["Unsupported file type."]},
        )

    raw = file_storage.read()
    _validate_size(raw, field)

    if extension == "pdf":
        if not raw.startswith(b"%PDF"):
            raise ValidationFailed(
                "The uploaded file is not a valid PDF.", errors={field: ["Invalid PDF."]}
            )
        return get_storage().save(raw, folder, extension)

    file_storage.stream.seek(0)
    return save_image(file_storage, folder, field=field)


def delete_file(relative_path):
    if not relative_path:
        return False
    try:
        return get_storage().delete(relative_path)
    except OSError:
        return False


def file_url(relative_path):
    if not relative_path:
        return None
    return get_storage().url(relative_path)


def ensure_upload_folder(app):
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
