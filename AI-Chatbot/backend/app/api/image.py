"""
Image generation router.
"""
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAIError

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ai import ImageGenerateRequest, ImageGenerateResponse
from app.services.image_service import generate_image

router = APIRouter(prefix="/image", tags=["image"])


@router.post("/generate", response_model=ImageGenerateResponse)
async def generate(
    body: ImageGenerateRequest,
    current_user: User = Depends(get_current_user),
) -> ImageGenerateResponse:
    try:
        image_url = await generate_image(body.prompt, current_user.email)
    except OpenAIError as e:
        raise HTTPException(status_code=502, detail={"error": "llm_error", "message": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "unexpected", "message": str(e)})

    return ImageGenerateResponse(image_url=image_url, thread_id=body.thread_id)
