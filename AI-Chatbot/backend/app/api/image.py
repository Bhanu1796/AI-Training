"""
Image generation router.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from openai import OpenAIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import ImageGenerateRequest, ImageGenerateResponse
from app.services.chat_service import save_message
from app.services.image_service import generate_image

router = APIRouter(prefix="/image", tags=["image"])

_GENERATED_DIR = Path(settings.UPLOAD_DIR) / "generated"


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate(
    body: ImageGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImageGenerateResponse:
    try:
        image_url = await generate_image(body.prompt, current_user.email)
    except OpenAIError as e:
        raise HTTPException(status_code=502, detail={"error": "llm_error", "message": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "unexpected", "message": str(e)})

    # Persist both messages so they survive re-fetches
    thread_uuid = uuid.UUID(body.thread_id)
    await save_message(db, thread_uuid, current_user.id, "user", body.prompt)
    await save_message(db, thread_uuid, current_user.id, "assistant", f"![generated image]({image_url})")
    await db.commit()

    return ImageGenerateResponse(image_url=image_url, thread_id=body.thread_id)


@router.get("/serve/{filename}")
async def serve_generated_image(filename: str) -> FileResponse:
    """Serve a previously generated image from local disk.
    No auth required — filenames are unguessable UUIDs.
    """
    safe_name = Path(filename).name
    file_path = _GENERATED_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/png")
