"""
Unit tests for rag_service — mocks LiteLLM and ChromaDB.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.auth_service import register_user
from app.services.chat_service import create_thread, get_thread_messages


@pytest.mark.asyncio
async def test_stream_rag_response_saves_messages(db):
    user = await register_user(db, "rag_user@example.com", "pass")
    thread = await create_thread(db, user)

    mock_docs = [MagicMock(page_content="Relevant content")]

    async def mock_stream(*args, **kwargs):
        for token in ["Hello", " from", " RAG"]:
            yield token

    with (
        patch("app.services.rag_service.retrieve_documents", return_value=mock_docs),
        patch("app.services.rag_service.rag_chain") as mock_chain,
    ):
        mock_chain.astream = mock_stream

        from app.services.rag_service import stream_rag_response

        chunks = []
        async for chunk in stream_rag_response(db, thread.id, user, "What is RAG?"):
            chunks.append(chunk)

    assert "".join(chunks) == "Hello from RAG"

    messages = await get_thread_messages(db, thread.id, user)
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"
    assert messages[1].content == "Hello from RAG"
