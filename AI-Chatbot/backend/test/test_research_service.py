"""
Unit tests for research_service — Project 12 (MCP Integration).

Verifies that:
  1. The happy path calls search_arxiv_via_mcp (not the direct arxiv library).
  2. When search_arxiv_via_mcp raises, the service falls back to _search_arxiv
     and the digest still streams normally.
  3. An empty result from MCP causes an early-return "no papers" assistant message.

All external calls (MCP, LLM chains) are mocked — no real network traffic.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.auth_service import register_user
from app.services.chat_service import create_thread, get_thread_messages

# ── Shared test fixtures ──────────────────────────────────────────────────────

_FAKE_PAPERS = [
    {
        "id": "https://arxiv.org/abs/2401.00001",
        "title": "Attention Is All You Need",
        "authors": "Vaswani et al.",
        "year": 2017,
        "abstract": "We propose a new simple network architecture, the Transformer.",
        "url": "https://arxiv.org/abs/2401.00001",
    },
    {
        "id": "https://arxiv.org/abs/2401.00002",
        "title": "BERT: Pre-training of Deep Bidirectional Transformers",
        "authors": "Devlin et al.",
        "year": 2019,
        "abstract": "We introduce BERT, a language representation model.",
        "url": "https://arxiv.org/abs/2401.00002",
    },
    {
        "id": "https://arxiv.org/abs/2401.00003",
        "title": "GPT-3: Language Models are Few-Shot Learners",
        "authors": "Brown et al.",
        "year": 2020,
        "abstract": "We train GPT-3, an autoregressive language model.",
        "url": "https://arxiv.org/abs/2401.00003",
    },
]

_EVALUATION_SUFFICIENT = {"sufficient": True, "refined_query": ""}
_DIGEST_TOKENS = ["# Research Digest\n", "## Executive Summary\n", "Key findings here."]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _collect(gen) -> list[str]:
    """Drain an async generator into a list."""
    chunks = []
    async for chunk in gen:
        chunks.append(chunk)
    return chunks


def _mock_digest_chain():
    """Return an async generator that yields _DIGEST_TOKENS."""

    async def _astream(*args, **kwargs):
        for token in _DIGEST_TOKENS:
            yield token

    chain = MagicMock()
    chain.astream = _astream
    return chain


# ── Test 1: happy path uses MCP ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stream_research_digest_uses_mcp(db):
    user = await register_user(db, "research_mcp@example.com", "pass")
    thread = await create_thread(db, user)

    with (
        patch(
            "app.services.research_service.search_arxiv_via_mcp",
            new=AsyncMock(return_value=_FAKE_PAPERS),
        ) as mock_mcp,
        patch(
            "app.services.research_service._evaluation_chain",
            new=MagicMock(ainvoke=AsyncMock(return_value=_EVALUATION_SUFFICIENT)),
        ),
        patch(
            "app.services.research_service._digest_chain",
            new=_mock_digest_chain(),
        ),
    ):
        from app.services.research_service import stream_research_digest

        chunks = await _collect(
            stream_research_digest(db, thread.id, user, "transformers in NLP")
        )

    # MCP was called (not the direct arxiv library)
    mock_mcp.assert_called_once()
    call_args = mock_mcp.call_args
    assert "transformers" in call_args.args[0].lower() or "transformers" in str(call_args.kwargs).lower()

    # Two messages persisted: user question + assistant digest
    messages = await get_thread_messages(db, thread.id, user)
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"
    assert "Research Digest" in messages[1].content


# ── Test 2: MCP failure triggers fallback to direct arxiv ────────────────────

@pytest.mark.asyncio
async def test_mcp_fallback_on_failure(db):
    user = await register_user(db, "research_fallback@example.com", "pass")
    thread = await create_thread(db, user)

    with (
        patch(
            "app.services.research_service.search_arxiv_via_mcp",
            new=AsyncMock(side_effect=RuntimeError("MCP subprocess unavailable")),
        ) as mock_mcp,
        patch(
            "app.services.research_service._search_arxiv",
            return_value=_FAKE_PAPERS,
        ) as mock_direct,
        patch(
            "app.services.research_service._evaluation_chain",
            new=MagicMock(ainvoke=AsyncMock(return_value=_EVALUATION_SUFFICIENT)),
        ),
        patch(
            "app.services.research_service._digest_chain",
            new=_mock_digest_chain(),
        ),
    ):
        from app.services.research_service import stream_research_digest

        chunks = await _collect(
            stream_research_digest(db, thread.id, user, "neural networks")
        )

    # MCP was attempted then fell back to the direct arxiv helper
    mock_mcp.assert_called_once()
    mock_direct.assert_called_once()

    # Digest still streamed and assistant message was saved
    messages = await get_thread_messages(db, thread.id, user)
    assert len(messages) == 2
    assert messages[1].role == "assistant"


# ── Test 3: empty MCP result → early return with "no papers" message ──────────

@pytest.mark.asyncio
async def test_no_papers_returns_early(db):
    user = await register_user(db, "research_empty@example.com", "pass")
    thread = await create_thread(db, user)

    with patch(
        "app.services.research_service.search_arxiv_via_mcp",
        new=AsyncMock(return_value=[]),
    ):
        from app.services.research_service import stream_research_digest

        chunks = await _collect(
            stream_research_digest(db, thread.id, user, "nonexistent topic xyz")
        )

    # A "no papers" warning chunk should be yielded
    full_text = "".join(chunks)
    assert "No papers found" in full_text or "no papers" in full_text.lower()

    # User question + early-return assistant message both persisted
    messages = await get_thread_messages(db, thread.id, user)
    assert len(messages) == 2
    assert messages[1].role == "assistant"
    assert "no papers" in messages[1].content.lower() or "No papers" in messages[1].content
