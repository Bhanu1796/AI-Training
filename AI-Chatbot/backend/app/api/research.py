"""
Research router — autonomous arXiv digest with streaming.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import ResearchDigestRequest
from app.services.chat_service import get_thread
from app.services.research_service import stream_research_digest

router = APIRouter(prefix="/research", tags=["research"])


@router.post("/query")
async def research_query(
    body: ResearchDigestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    thread_id = uuid.UUID(body.thread_id)
    thread = await get_thread(db, thread_id, current_user)
    if not thread:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Thread not found"},
        )

    return StreamingResponse(
        stream_research_digest(db, thread_id, current_user, body.query, body.max_papers),
        media_type="text/event-stream",
    )
