"""
DB-backed conversational memory utilities.
Fetches conversation history fresh from the database on every request (AD-05).
"""
import uuid
from typing import Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message


async def load_history(
    db: AsyncSession,
    thread_id: uuid.UUID,
    limit: int = 20,
) -> list[BaseMessage]:
    """Return the last `limit` messages in a thread as LangChain message objects."""
    result = await db.execute(
        select(Message)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages: Sequence[Message] = result.scalars().all()

    lc_messages: list[BaseMessage] = []
    for msg in reversed(messages):
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))

    return lc_messages
