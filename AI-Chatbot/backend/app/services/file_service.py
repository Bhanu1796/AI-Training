"""
File service — upload validation, storage, and metadata persistence.
"""
import mimetypes
import uuid
from pathlib import Path

import aiofiles
import filetype
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.file import UploadedFile
from app.models.user import User

ACCEPTED_MIME_TYPES: set[str] = {
    # Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    # Videos
    "video/mp4",
    "video/webm",
    # Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/plain",
    "text/csv",
    # Code files
    "text/x-python",
    "text/javascript",
    "application/javascript",
    "application/typescript",
    "text/x-c",
    "text/x-csrc",
    "text/x-c++src",
    "text/x-java",
    "text/x-java-source",
    "text/x-csharp",
    "text/x-go",
    "text/x-ruby",
    "text/x-rust",
    "text/x-php",
    "application/x-sh",
    "application/sql",
    "text/html",
    "text/css",
    "application/json",
    "application/xml",
    "text/xml",
    "application/x-yaml",
    "text/markdown",
    # Formula / LaTeX
    "application/x-latex",
    "text/x-tex",
}

# Extension → (canonical mime, file_type) for browser-declared text/plain files
_EXTENSION_OVERRIDES: dict[str, tuple[str, str]] = {
    ".py":     ("text/x-python",       "code"),
    ".js":     ("text/javascript",     "code"),
    ".jsx":    ("text/javascript",     "code"),
    ".ts":     ("application/typescript", "code"),
    ".tsx":    ("application/typescript", "code"),
    ".cpp":    ("text/x-c++src",       "code"),
    ".cc":     ("text/x-c++src",       "code"),
    ".c":      ("text/x-csrc",         "code"),
    ".h":      ("text/x-csrc",         "code"),
    ".java":   ("text/x-java",         "code"),
    ".cs":     ("text/x-csharp",       "code"),
    ".go":     ("text/x-go",           "code"),
    ".rb":     ("text/x-ruby",         "code"),
    ".rs":     ("text/x-rust",         "code"),
    ".php":    ("text/x-php",          "code"),
    ".sh":     ("application/x-sh",    "code"),
    ".bash":   ("application/x-sh",    "code"),
    ".sql":    ("application/sql",     "code"),
    ".html":   ("text/html",           "code"),
    ".htm":    ("text/html",           "code"),
    ".css":    ("text/css",            "code"),
    ".json":   ("application/json",    "code"),
    ".xml":    ("application/xml",     "code"),
    ".yaml":   ("application/x-yaml",  "code"),
    ".yml":    ("application/x-yaml",  "code"),
    ".md":     ("text/markdown",       "code"),
    ".tex":    ("application/x-latex", "formula"),
    ".latex":  ("application/x-latex", "formula"),
}

# Language hint for code rendering in the AI prompt
_MIME_TO_LANGUAGE: dict[str, str] = {
    "text/x-python":       "python",
    "text/javascript":     "javascript",
    "application/javascript": "javascript",
    "application/typescript": "typescript",
    "text/x-c++src":       "cpp",
    "text/x-csrc":         "c",
    "text/x-java":         "java",
    "text/x-java-source":  "java",
    "text/x-csharp":       "csharp",
    "text/x-go":           "go",
    "text/x-ruby":         "ruby",
    "text/x-rust":         "rust",
    "text/x-php":          "php",
    "application/x-sh":    "bash",
    "application/sql":     "sql",
    "text/html":           "html",
    "text/css":            "css",
    "application/json":    "json",
    "application/xml":     "xml",
    "text/xml":            "xml",
    "application/x-yaml":  "yaml",
    "text/markdown":       "markdown",
    "application/x-latex": "latex",
    "text/x-tex":          "latex",
}

_FILE_TYPE_MAP: dict[str, str] = {
    "image/": "image",
    "video/": "video",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
    "application/vnd.ms-excel": "excel",
    "text/csv": "excel",
    "text/x-python": "code",
    "text/javascript": "code",
    "application/javascript": "code",
    "application/typescript": "code",
    "text/x-c": "code",
    "text/x-csrc": "code",
    "text/x-c++src": "code",
    "text/x-java": "code",
    "text/x-java-source": "code",
    "text/x-csharp": "code",
    "text/x-go": "code",
    "text/x-ruby": "code",
    "text/x-rust": "code",
    "text/x-php": "code",
    "application/x-sh": "code",
    "application/sql": "code",
    "text/html": "code",
    "text/css": "code",
    "application/json": "code",
    "application/xml": "code",
    "text/xml": "code",
    "application/x-yaml": "code",
    "text/markdown": "code",
    "application/x-latex": "formula",
    "text/x-tex": "formula",
}


def get_language_hint(mime_type: str) -> str:
    """Return a language name suitable for a markdown fenced code block."""
    return _MIME_TO_LANGUAGE.get(mime_type, "text")


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

    # filetype sniffs bytes for a known signature; fall back to the upload's
    # declared content_type for plain-text / CSV which have no magic bytes.
    kind = filetype.guess(content)
    if kind is not None:
        detected_mime = kind.mime
    else:
        # Plain text and CSV/code files have no magic bytes — trust the declared type
        declared = (upload.content_type or "").split(";")[0].strip()
        detected_mime = declared if declared in ACCEPTED_MIME_TYPES else "application/octet-stream"

    # For generic text/plain or octet-stream, use the file extension to detect
    # code and formula files (browsers often declare these as text/plain)
    if detected_mime in ("text/plain", "application/octet-stream"):
        ext = Path(upload.filename or "").suffix.lower()
        if ext in _EXTENSION_OVERRIDES:
            detected_mime, _ = _EXTENSION_OVERRIDES[ext]

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

    # Derive file_type — prefer extension-based for code/formula
    ext = Path(upload.filename or "").suffix.lower()
    if ext in _EXTENSION_OVERRIDES:
        file_type = _EXTENSION_OVERRIDES[ext][1]
    else:
        file_type = _classify_file_type(detected_mime)

    # Persist metadata
    db_file = UploadedFile(
        id=file_id,
        user_id=user.id,
        thread_id=thread_id,
        original_filename=upload.filename or stored_filename,
        stored_path=str(stored_path),
        mime_type=detected_mime,
        file_type=file_type,
        file_size=len(content),
    )
    db.add(db_file)
    await db.flush()
    return db_file
