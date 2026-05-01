"""
File service — upload validation, storage, and metadata persistence.
"""
import mimetypes
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.file import UploadedFile
from app.models.user import User

ACCEPTED_MIME_TYPES: set[str] = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/plain",
    "text/csv",
}

_FILE_TYPE_MAP: dict[str, str] = {
    "image/": "image",
    "video/": "video",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
    "application/vnd.ms-excel": "excel",
    "text/csv": "excel",
}


def _classify_file_type(mime_type: str) -> str:
    for prefix, file_type in _FILE_TYPE_MAP.items():
        if mime_type.startswith(prefix):
            return file_type
    return "other"


async def upload_file(
    db: AsyncSession,
    user: User,
    upload: UploadFile,
    thread_id: uuid.UUID | None = None,
) -> UploadedFile:
    # Read content to validate MIME type server-side (do not trust extension)
    content = await upload.read()
    import magic  # python-magic for MIME detection

    detected_mime = magic.from_buffer(content, mime=True)
    if detected_mime not in ACCEPTED_MIME_TYPES:
        raise ValueError(f"Unsupported file type: {detected_mime}")

    if len(content) > settings.max_upload_bytes:
        raise ValueError(f"File exceeds maximum size of {settings.MAX_UPLOAD_MB} MB.")

    # Persist to disk
    upload_dir = Path(settings.UPLOAD_DIR) / str(user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4()
    suffix = Path(upload.filename or "file").suffix or mimetypes.guess_extension(detected_mime) or ""
    stored_filename = f"{file_id}{suffix}"
    stored_path = upload_dir / stored_filename

    async with aiofiles.open(stored_path, "wb") as f:
        await f.write(content)

    # Persist metadata
    db_file = UploadedFile(
        id=file_id,
        user_id=user.id,
        thread_id=thread_id,
        original_filename=upload.filename or stored_filename,
        stored_path=str(stored_path),
        mime_type=detected_mime,
        file_type=_classify_file_type(detected_mime),
        file_size=len(content),
    )
    db.add(db_file)
    await db.flush()
    return db_file
