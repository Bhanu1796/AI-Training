"""
MCP client — arXiv search via mcp_simple_arxiv stdio MCP server.

Usage:
    papers = await search_arxiv_via_mcp("transformer attention", max_results=5)

Raises on any failure so callers can fall back to the direct arxiv library.
"""
import asyncio
import logging
import re
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_mcp_adapters.tools import load_mcp_tools

logger = logging.getLogger(__name__)

# Seconds to wait for the tool call itself (network + LLM not involved, just HTTP to arXiv)
_TOOL_TIMEOUT = 30


async def search_arxiv_via_mcp(query: str, max_results: int = 5) -> list[dict]:
    """
    Search arXiv using the mcp_simple_arxiv MCP server (spawned as a subprocess).

    Returns a list of paper dicts with keys:
        id, title, authors, year, abstract, url

    Raises on connection/timeout failure so the caller can fall back.
    """
    n = min(max_results, 10)

    # Pass the query as-is — arXiv handles natural language queries well,
    # and strict phrase/field searches can return 0 results for multi-word topics.
    formatted_query = query.strip()

    server_params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "mcp_simple_arxiv"],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await load_mcp_tools(session)

            search_tool = next(
                (t for t in tools if t.name == "search_papers"), None
            )
            if search_tool is None:
                raise RuntimeError(
                    "search_papers tool not found in mcp_simple_arxiv — "
                    "is the package installed correctly?"
                )

            result = await asyncio.wait_for(
                search_tool.ainvoke(
                    {
                        "query": formatted_query,
                        "max_results": n,
                        "sort_by": "relevance",
                        "sort_order": "descending",
                    }
                ),
                timeout=_TOOL_TIMEOUT,
            )

    papers = _parse_mcp_results(str(result))
    logger.debug("MCP search for %r returned %d papers", query, len(papers))
    return papers


def _parse_mcp_results(text: str) -> list[dict]:
    """
    Parse the plain-text output of mcp_simple_arxiv's search_papers tool.

    Expected format per entry:
        N. Title of the Paper
           Authors: Author One, Author Two
           ID: 2401.12345v2          (or full URL)
           Categories: Primary: cs.AI, Additional: cs.LG
           Published: 2024-01-15 00:00:00+00:00
           Preview: First sentence of the abstract.
    """
    papers: list[dict] = []

    # Split on lines that start a new numbered entry
    entries = re.split(r"\n(?=\d+\. )", text.strip())

    for entry in entries:
        entry = entry.strip()
        if not re.match(r"\d+\. ", entry):
            continue  # header line ("Found N total results…") or blank

        lines = entry.splitlines()
        if not lines:
            continue

        # First line: "{n}. Title text"
        title_match = re.match(r"\d+\.\s+(.+)", lines[0])
        title = title_match.group(1).strip() if title_match else ""

        # Collect labelled fields from the indented lines
        fields: dict[str, str] = {}
        for line in lines[1:]:
            m = re.match(r"\s+(Authors|ID|Published|Preview|Categories):\s+(.+)", line)
            if m:
                fields[m.group(1)] = m.group(2).strip()

        # Build the URL — the ID field may be a bare arxiv ID or a full URL
        raw_id = fields.get("ID", "").split()[0]  # take first token only
        if raw_id.startswith("http"):
            paper_url = raw_id
        elif raw_id:
            paper_url = f"https://arxiv.org/abs/{raw_id}"
        else:
            paper_url = ""

        authors = fields.get("Authors", "")
        abstract = fields.get("Preview", "")

        year_match = re.search(r"(\d{4})", fields.get("Published", ""))
        year = int(year_match.group(1)) if year_match else 0

        if title and paper_url:
            papers.append(
                {
                    "id": paper_url,
                    "title": title,
                    "authors": authors,
                    "year": year,
                    "abstract": abstract,
                    "url": paper_url,
                }
            )

    return papers
