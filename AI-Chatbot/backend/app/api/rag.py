"""
RAG router — streaming retrieval-augmented generation.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import RAGQueryRequest
from app.services.chat_service import get_thread
from app.services.rag_service import stream_rag_response

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/query")
async def rag_query(
    body: RAGQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    thread_id = uuid.UUID(body.thread_id)
    thread = await get_thread(db, thread_id, current_user)
    if not thread:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Thread not found"})

    return StreamingResponse(
        stream_rag_response(db, thread_id, current_user, body.query),
        media_type="text/event-stream",
    )
