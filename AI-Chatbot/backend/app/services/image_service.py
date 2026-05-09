"""
Image generation service — delegates to the image generation model via the LiteLLM proxy.
Generated images are saved to disk and served via a local endpoint so the URL never expires.
"""
import base64
import uuid
from pathlib import Path

import httpx
from openai import OpenAIError

from app.ai.llm import async_openai_client
from app.core.config import settings
from app.core.logging import logger

# Sub-folder inside UPLOAD_DIR dedicated to AI-generated images
_GENERATED_DIR = Path(settings.UPLOAD_DIR) / "generated"


async def generate_image(prompt: str, user_email: str) -> str:
    """Generate an image, persist it to disk, and return a stable local serve URL."""
    _GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    try:
        response = await async_openai_client.images.generate(
            model=settings.IMAGE_GEN_MODEL,
            prompt=prompt,
            n=1,
        )
        image_data = response.data[0]

        filename = f"{uuid.uuid4()}.png"
        dest = _GENERATED_DIR / filename

        if image_data.b64_json:
            # Response already base64 — decode and write directly
            dest.write_bytes(base64.b64decode(image_data.b64_json))
        elif image_data.url:
            # Temporary signed URL — download server-side before it expires
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(image_data.url)
                r.raise_for_status()
                dest.write_bytes(r.content)
        else:
            raise ValueError("No image data in response")

        # Return a stable local URL served by our own backend
        return f"/api/image/serve/{filename}"

    except OpenAIError as e:
        logger.error("Image generation failed: %s", e)
        raise
    except Exception as e:
        logger.error("Image generation unexpected error: %s", e)
        raise
