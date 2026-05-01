"""
Chat router — threads and streaming messages.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import MessageCreate, MessageRead, ThreadCreate, ThreadRead, ThreadUpdate
from app.services.chat_service import (
    create_thread,
    delete_thread,
    get_thread,
    get_thread_messages,
    list_threads,
    stream_chat_response,
    update_thread_title,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/threads", response_model=ThreadRead, status_code=status.HTTP_201_CREATED)
async def create_new_thread(
    body: ThreadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThreadRead:
    thread = await create_thread(db, current_user, body.title)
    return ThreadRead.model_validate(thread)


@router.get("/threads", response_model=list[ThreadRead])
async def list_user_threads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ThreadRead]:
    threads = await list_threads(db, current_user)
    return [ThreadRead.model_validate(t) for t in threads]


@router.get("/threads/{thread_id}", response_model=ThreadRead)
async def get_thread_detail(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThreadRead:
    thread = await get_thread(db, thread_id, current_user)
    if not thread:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Thread not found"})
    return ThreadRead.model_validate(thread)


@router.patch("/threads/{thread_id}", response_model=ThreadRead)
async def rename_thread(
    thread_id: uuid.UUID,
    body: ThreadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThreadRead:
    from sqlalchemy import update as sa_update
    from app.models.thread import Thread as ThreadModel
    await db.execute(
        sa_update(ThreadModel)
        .where(ThreadModel.id == thread_id, ThreadModel.user_id == current_user.id)
        .values(title=body.title)
    )
    thread = await get_thread(db, thread_id, current_user)
    if not thread:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Thread not found"})
    await db.refresh(thread)
    return ThreadRead.model_validate(thread)


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_thread(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    thread = await get_thread(db, thread_id, current_user)
    if not thread:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Thread not found"})
    await delete_thread(db, thread)


@router.get("/threads/{thread_id}/messages", response_model=list[MessageRead])
async def list_messages(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageRead]:
    messages = await get_thread_messages(db, thread_id, current_user)
    return [MessageRead.model_validate(m) for m in messages]


@router.post("/threads/{thread_id}/messages")
async def send_message(
    thread_id: uuid.UUID,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    thread = await get_thread(db, thread_id, current_user)
    if not thread:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Thread not found"})

    async def generate():
        # Use a fresh session owned by the generator so it commits after streaming
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as stream_db:
            async for chunk in stream_chat_response(stream_db, thread_id, current_user, body.content):
                yield chunk
            await stream_db.commit()

    return StreamingResponse(generate(), media_type="text/event-stream")
