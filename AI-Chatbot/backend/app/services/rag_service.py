"""
RAG service — ingestion and streaming retrieval-augmented responses.
"""
import uuid
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chains.rag_chain import rag_chain
from app.ai.memory.db_memory import load_history
from app.ai.rag.ingestion import ingest_document
from app.ai.rag.retrieval import format_context, retrieve_documents
from app.models.file import UploadedFile
from app.models.user import User
from app.services.chat_service import save_message


async def ingest_uploaded_file(db_file: UploadedFile, user_id: str) -> int:
    """Chunk and embed an uploaded file. Returns chunk count."""
    return await ingest_document(
        file_path=db_file.stored_path,
        mime_type=db_file.mime_type,
        user_id=user_id,
        file_id=str(db_file.id),
    )


async def stream_rag_response(
    db: AsyncSession,
    thread_id: uuid.UUID,
    user: User,
    query: str,
) -> AsyncIterator[str]:
    """Retrieve context, stream the grounded response, then persist both messages."""
    # Persist user question
    await save_message(db, thread_id, user.id, "user", query)

    # Retrieve relevant document chunks
    docs = await retrieve_documents(query, str(user.id))
    context = format_context(docs)

    # Load conversation history
    history = await load_history(db, thread_id)

    # Stream the grounded response
    full_response = ""
    async for chunk in rag_chain.astream(
        {"human_input": query, "history": history, "context": context},
        config={"metadata": {"user_email": user.email}},
    ):
        full_response += chunk
        yield chunk

    # Persist assistant answer (KI-06: must save after stream completes)
    await save_message(db, thread_id, user.id, "assistant", full_response)
