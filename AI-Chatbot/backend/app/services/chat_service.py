"""
Chat service — thread and message CRUD, streaming chat responses.
"""
import base64
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

from langchain_core.messages import HumanMessage as LCHumanMessage, SystemMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.chains.chat_chain import chat_chain
from app.ai.llm import llm
from app.ai.memory.db_memory import load_history
from app.models.file import UploadedFile
from app.models.message import Message
from app.models.thread import Thread
from app.models.user import User
from app.services.file_service import get_language_hint

# System prompt without the LangChain template placeholders — used for direct LLM calls
_SYSTEM_PROMPT = (
    Path(__file__).parent.parent / "ai" / "prompts" / "chat.txt"
).read_text(encoding="utf-8").split("{history}")[0].strip()


def _extract_file_text(db_file: UploadedFile, max_chars: int = 12_000) -> str | None:
    """Extract plain text from an uploaded file to inject into the prompt."""
    path = Path(db_file.stored_path)
    if not path.exists():
        return None
    mime = db_file.mime_type
    file_type = db_file.file_type
    try:
        if mime == "application/pdf":
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            pages = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(pages).strip()
        elif mime in ("text/plain", "text/csv"):
            text = path.read_text(encoding="utf-8", errors="ignore").strip()
        elif mime in (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ):
            import pandas as pd
            df = pd.read_excel(str(path))
            text = df.to_string(index=False)
        elif file_type == "code":
            # Read source code and wrap in a fenced code block with language hint
            raw = path.read_text(encoding="utf-8", errors="ignore").strip()
            lang = get_language_hint(mime)
            text = f"```{lang}\n{raw}\n```"
        elif file_type == "formula":
            # Read LaTeX/formula file
            raw = path.read_text(encoding="utf-8", errors="ignore").strip()
            text = f"LaTeX formula content:\n```latex\n{raw}\n```"
        else:
            return None
        if len(text) > max_chars:
            text = text[:max_chars] + "\n... [content truncated]"
        return text if text else None
    except Exception:
        return None


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
    file_ids: list[uuid.UUID] | None = None,
) -> Message:
    message = Message(
        id=uuid.uuid4(),
        thread_id=thread_id,
        user_id=user_id,
        role=role,
        content=content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(message)
    await db.flush()
    # Link uploaded files to this message
    if file_ids:
        from sqlalchemy import update as sa_update
        await db.execute(
            sa_update(UploadedFile)
            .where(UploadedFile.id.in_(file_ids))
            .values(message_id=message.id)
        )
    await db.refresh(message)
    return message


async def get_thread_messages(db: AsyncSession, thread_id: uuid.UUID, user: User) -> list[Message]:
    result = await db.execute(
        select(Message)
        .join(Thread)
        .where(Thread.id == thread_id, Thread.user_id == user.id)
        .options(selectinload(Message.files))
        .order_by(Message.created_at.asc(), Message.role.desc())
    )
    return list(result.scalars().all())


async def stream_chat_response(
    db: AsyncSession,
    thread_id: uuid.UUID,
    user: User,
    human_input: str,
    file_ids: list[uuid.UUID] | None = None,
) -> AsyncIterator[str]:
    """Save user message, stream assistant response, then persist assistant message."""
    # Persist user message (link any uploaded files to it)
    await save_message(db, thread_id, user.id, "user", human_input, file_ids=file_ids)

    # Fetch attached files
    db_files = []
    if file_ids:
        result = await db.execute(
            select(UploadedFile).where(UploadedFile.id.in_(file_ids))
        )
        db_files = list(result.scalars().all())

    # Separate visual files (image/video) from text-extractable files
    visual_files = [f for f in db_files if f.file_type in ("image", "video")]
    text_files = [f for f in db_files if f.file_type not in ("image", "video")]

    # Build enriched text input from non-image attachments
    enriched_input = human_input
    file_sections: list[str] = []
    for db_file in text_files:
        text = _extract_file_text(db_file)
        if text:
            file_sections.append(
                f"--- Attached file: {db_file.original_filename} ---\n{text}"
            )
    if file_sections:
        enriched_input = human_input + "\n\n" + "\n\n".join(file_sections)

    # Fetch conversation history — last 5 conversations (10 messages)
    history = await load_history(db, thread_id, limit=10)

    full_response = ""

    if visual_files:
        # Build multimodal HumanMessage: text + base64-encoded images/videos
        content: list = [{"type": "text", "text": enriched_input}]
        for media in visual_files:
            media_path = Path(media.stored_path)
            if not media_path.exists():
                continue
            media_bytes = media_path.read_bytes()
            b64 = base64.b64encode(media_bytes).decode("utf-8")
            if media.file_type == "image":
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{media.mime_type};base64,{b64}"},
                })
            else:
                # Video — passed as base64 video_url (Gemini vision API format)
                content.append({
                    "type": "video_url",
                    "video_url": {"url": f"data:{media.mime_type};base64,{b64}"},
                })

        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            *history,
            LCHumanMessage(content=content),
        ]

        # Stream directly from the LLM (bypasses text-only chain template)
        async for chunk in llm.astream(
            messages,
            config={"metadata": {"user_email": user.email}},
        ):
            token = chunk.content if hasattr(chunk, "content") else str(chunk)
            if token:
                full_response += token
                yield token
    else:
        # Text-only path — use the standard LCEL chain (no visual attachments)
        async for chunk in chat_chain.astream(
            {"human_input": enriched_input, "history": history},
            config={"metadata": {"user_email": user.email}},
        ):
            full_response += chunk
            yield chunk

    # Persist assistant message
    await save_message(db, thread_id, user.id, "assistant", full_response)
