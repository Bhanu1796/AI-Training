"""
Files router — multipart upload with MIME validation.
"""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.file import FileUploadResponse
from app.services.file_service import upload_file

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=FileUploadResponse)
async def upload(
    file: UploadFile = File(...),
    thread_id: uuid.UUID | None = Form(default=None),
    ingest: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileUploadResponse:
    try:
        db_file = await upload_file(db, current_user, file, thread_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": "validation_error", "message": str(e)})

    # Optionally ingest into RAG vector store
    if ingest:
        from app.services.rag_service import ingest_uploaded_file
        try:
            await ingest_uploaded_file(db_file, str(current_user.id))
        except ValueError as e:
            raise HTTPException(status_code=422, detail={"error": "ingest_error", "message": str(e)})

    from app.schemas.file import FileRead
    return FileUploadResponse(file=FileRead.model_validate(db_file))
