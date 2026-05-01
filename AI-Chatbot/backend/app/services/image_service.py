"""
Image generation service — delegates to the image generation model via the LiteLLM proxy.
"""
import base64
import uuid
from pathlib import Path

from openai import OpenAIError

from app.ai.llm import openai_client
from app.core.config import settings
from app.core.logging import logger


async def generate_image(prompt: str, user_email: str) -> str:
    """Generate an image and return the URL or base64 data URL."""
    try:
        response = openai_client.images.generate(
            model=settings.IMAGE_GEN_MODEL,
            prompt=prompt,
            n=1,
            size="1024x1024",
            user=user_email,
            extra_body={
                "metadata": {
                    "application": settings.APP_NAME,
                    "environment": settings.ENVIRONMENT,
                }
            },
        )
        image_data = response.data[0]
        if image_data.url:
            return image_data.url
        if image_data.b64_json:
            return f"data:image/png;base64,{image_data.b64_json}"
        raise ValueError("No image data in response")
    except OpenAIError as e:
        logger.error("Image generation failed: %s", e)
        raise
