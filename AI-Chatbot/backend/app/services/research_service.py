"""
Research Digest service — autonomous arXiv search, coverage evaluation, and streaming digest.
"""
import asyncio
import logging
import uuid
from pathlib import Path
from typing import AsyncIterator

import arxiv
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm, llm_long
from app.ai.mcp_client import search_arxiv_via_mcp
from app.models.user import User
from app.services.chat_service import save_message

logger = logging.getLogger(__name__)

# ── Prompt setup ─────────────────────────────────────────────────────────────

_DIGEST_PROMPT_PATH = Path(__file__).parent.parent / "ai" / "prompts" / "research.txt"
_digest_system_prompt = _DIGEST_PROMPT_PATH.read_text(encoding="utf-8")

_digest_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", _digest_system_prompt),
        MessagesPlaceholder(variable_name="history"),
        ("human", "Research topic: {query}\n\nPapers found:\n\n{papers}"),
    ]
)

_digest_chain = _digest_prompt | llm_long | StrOutputParser()

_evaluation_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are evaluating whether a set of arXiv search results provides "
                "sufficient coverage to write a comprehensive research digest.\n\n"
                "Respond with valid JSON only — no markdown fences, no extra text.\n"
                'Format: {"sufficient": true|false, "refined_query": "<alternative search query or empty string>"}\n\n'
                "Set sufficient=true if there are 3 or more relevant papers.\n"
                "Set sufficient=false and provide a refined_query when the results are off-topic "
                "or clearly too sparse to write a meaningful digest."
            ),
        ),
        (
            "human",
            (
                "Research topic: {query}\n\n"
                "Paper titles found ({count} total):\n{titles}\n\n"
                "Are these sufficient for a comprehensive digest?"
            ),
        ),
    ]
)

_evaluation_chain = _evaluation_prompt | llm | JsonOutputParser()


# ── arXiv helper (sync — always run via asyncio.to_thread) ───────────────────

def _search_arxiv(query: str, max_results: int = 5) -> list[dict]:
    """
    Synchronous arXiv search. Must be called via asyncio.to_thread().

    page_size is set equal to max_results so the library makes exactly one
    small API request instead of fetching the default 100-result page,
    which avoids HTTP 429 rate-limit responses from export.arxiv.org.
    """
    # Cap at 10 to stay well within arXiv's rate limits
    n = min(max_results, 10)
    client = arxiv.Client(
        page_size=n,
        delay_seconds=3,   # arXiv recommends ≥3 s between requests
        num_retries=2,     # reduced retries so 429 surfaces quickly
    )
    search = arxiv.Search(
        query=query,
        max_results=n,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    results = []
    try:
        for r in client.results(search):
            results.append(
                {
                    "id": r.entry_id,
                    "title": r.title,
                    "authors": ", ".join(str(a) for a in r.authors[:3]),
                    "year": r.published.year,
                    "abstract": r.summary[:400],
                    "url": r.entry_id,
                }
            )
    except arxiv.HTTPError as exc:
        if exc.status == 429:
            # Re-raise so the caller can show a rate-limit message
            raise
        import logging as _log
        _log.getLogger(__name__).warning(
            "arXiv search error for query %r: %s — returning %d partial results",
            query, exc, len(results),
        )
    except Exception as exc:
        import logging as _log
        _log.getLogger(__name__).warning(
            "arXiv search error for query %r: %s — returning %d partial results",
            query, exc, len(results),
        )
    return results


def _format_papers(papers: list[dict]) -> str:
    """Format paper list into a readable block for the LLM prompt."""
    lines = []
    for i, p in enumerate(papers, 1):
        lines.append(
            f"{i}. **{p['title']}**\n"
            f"   Authors: {p['authors']} ({p['year']})\n"
            f"   URL: {p['url']}\n"
            f"   Abstract: {p['abstract']}...\n"
        )
    return "\n".join(lines)


# ── Main streaming generator ─────────────────────────────────────────────────

async def stream_research_digest(
    db: AsyncSession,
    thread_id: uuid.UUID,
    user: User,
    query: str,
    max_papers: int = 10,
) -> AsyncIterator[str]:
    """
    Autonomous research agent:
      1. Search arXiv for the query
      2. LLM evaluates coverage — optionally triggers one refined search
      3. Stream structured markdown digest via LCEL chain
    Both the user question and the full assistant digest are persisted to DB.
    """
    # Persist user message immediately so it survives the stream
    await save_message(db, thread_id, user.id, "user", f"Research digest: {query}")
    await db.commit()

    # Accumulate every yielded chunk so the persisted message matches the stream
    full_response: str = ""

    def _yield(text: str):
        nonlocal full_response
        full_response += text
        return text

    # ── Phase 1: Initial search ───────────────────────────────────────────────
    yield _yield(f"🔍 Searching arXiv for **{query}**...\n\n")
    search_source = "MCP (mcp_simple_arxiv)"
    try:
        papers: list[dict] = await search_arxiv_via_mcp(query, min(max_papers, 5))
        if not papers:
            raise ValueError("MCP returned no results")
    except Exception as exc:
        logger.warning("MCP search failed (%s) — falling back to direct arxiv", exc)
        search_source = "Direct arXiv API (fallback)"
        try:
            papers = await asyncio.to_thread(_search_arxiv, query, min(max_papers, 5))
        except arxiv.HTTPError as rate_exc:
            if rate_exc.status == 429:
                msg = (
                    "⚠️ arXiv is temporarily rate-limited — too many requests in a short period. "
                    "Please wait a few minutes and try again."
                )
                yield _yield(msg + "\n\n")
                await save_message(db, thread_id, user.id, "assistant", msg)
                await db.commit()
                return
            papers = []
    yield _yield(f"📄 Found {len(papers)} papers via **{search_source}**. Evaluating coverage...\n\n")

    # ── Phase 2: Coverage evaluation (max 2 rounds total) ────────────────────
    if papers:
        titles_block = "\n".join(f"- {p['title']}" for p in papers)
        try:
            evaluation = await _evaluation_chain.ainvoke(
                {"query": query, "count": len(papers), "titles": titles_block},
                config={"metadata": {"user_email": user.email}},
            )
            sufficient: bool = bool(evaluation.get("sufficient", True))
            refined_query: str = evaluation.get("refined_query", "") or ""
        except Exception:
            # If evaluation fails, proceed with what we have
            sufficient = True
            refined_query = ""

        # ── Phase 3: Optional refined search (only once) ─────────────────────
        if not sufficient and refined_query.strip():
            yield _yield(f"🔎 Expanding search: **{refined_query.strip()}**...\n\n")
            try:
                extra = await search_arxiv_via_mcp(refined_query.strip(), 5)
                if not extra:
                    raise ValueError("MCP returned no results")
            except Exception as exc:
                logger.warning("MCP refined search failed (%s) — falling back to direct arxiv", exc)
                extra = await asyncio.to_thread(_search_arxiv, refined_query.strip(), 5)
            # Deduplicate by arxiv ID
            seen_ids = {p["id"] for p in papers}
            papers.extend(p for p in extra if p["id"] not in seen_ids)
            yield _yield(f"\u2705 Collected {len(papers)} papers total. Generating digest...\n\n")
        else:
            yield _yield(f"\u2705 Coverage sufficient. Generating digest...\n\n")
    else:
        msg = f"\u26a0\ufe0f No papers found on arXiv for **{query}**. Try a different or broader topic."
        yield _yield("\u26a0\ufe0f No papers found on arXiv for that query. Try a different topic.\n\n")
        await save_message(db, thread_id, user.id, "assistant", full_response)
        await db.commit()
        return

    yield _yield("---\n\n")

    # ── Phase 4: Stream structured digest ────────────────────────────────────
    formatted_papers = _format_papers(papers)

    async for chunk in _digest_chain.astream(
        {"query": query, "papers": formatted_papers, "history": []},
        config={"metadata": {"user_email": user.email}},
    ):
        full_response += chunk
        yield chunk

    # Persist the complete output (progress + digest)
    await save_message(db, thread_id, user.id, "assistant", full_response)
    await db.commit()
