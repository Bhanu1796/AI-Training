"""
Chat service — thread and message CRUD, streaming chat responses.
"""
import uuid
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.chains.chat_chain import chat_chain
from app.ai.memory.db_memory import load_history
from app.models.message import Message
from app.models.thread import Thread
from app.models.user import User


async def create_thread(db: AsyncSession, user: User, title: str = "New Chat") -> Thread:
    thread = Thread(id=uuid.uuid4(), user_id=user.id, title=title)
    db.add(thread)
    await db.flush()
    await db.refresh(thread)
    return thread


async def list_threads(db: AsyncSession, user: User) -> list[Thread]:
    result = await db.execute(
        select(Thread)
        .where(Thread.user_id == user.id)
        .order_by(Thread.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_thread(db: AsyncSession, thread_id: uuid.UUID, user: User) -> Thread | None:
    result = await db.execute(
        select(Thread)
        .where(Thread.id == thread_id, Thread.user_id == user.id)
        .options(selectinload(Thread.messages))
    )
    return result.scalar_one_or_none()


async def update_thread_title(db: AsyncSession, thread: Thread, title: str) -> Thread:
    thread.title = title
    await db.flush()
    await db.refresh(thread)
    return thread


async def delete_thread(db: AsyncSession, thread: Thread) -> None:
    await db.delete(thread)
    await db.flush()


async def save_message(
    db: AsyncSession,
    thread_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    content: str,
) -> Message:
    message = Message(
        id=uuid.uuid4(),
        thread_id=thread_id,
        user_id=user_id,
        role=role,
        content=content,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def get_thread_messages(db: AsyncSession, thread_id: uuid.UUID, user: User) -> list[Message]:
    result = await db.execute(
        select(Message)
        .join(Thread)
        .where(Thread.id == thread_id, Thread.user_id == user.id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


async def stream_chat_response(
    db: AsyncSession,
    thread_id: uuid.UUID,
    user: User,
    human_input: str,
) -> AsyncIterator[str]:
    """Save user message, stream assistant response, then persist assistant message."""
    # Persist user message
    await save_message(db, thread_id, user.id, "user", human_input)

    # Fetch conversation history
    history = await load_history(db, thread_id)

    # Stream from the chain
    full_response = ""
    async for chunk in chat_chain.astream(
        {"human_input": human_input, "history": history},
        config={"metadata": {"user_email": user.email}},
    ):
        full_response += chunk
        yield chunk

    # Persist assistant message
    await save_message(db, thread_id, user.id, "assistant", full_response)
