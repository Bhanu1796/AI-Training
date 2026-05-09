# """
# NL-to-SQL service — read-only natural language query against a target database.

# Two-step approach (no agent framework):
#   1. LLM generates a SQL SELECT from the question + schema
#   2. We execute it directly and ask the LLM to format the result

# This guarantees the generated SQL is always captured.
# Enforces keyword blocking for all DML and DDL statements.
# """
# import asyncio
# import re
# from typing import Any

# from fastapi import HTTPException
# from langchain_community.utilities import SQLDatabase
# from langchain_core.messages import HumanMessage

# from app.ai.llm import llm
# from app.core.config import settings

# _BLOCKED_KEYWORDS = re.compile(
#     r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|EXEC|EXECUTE)\b",
#     flags=re.IGNORECASE,
# )

# _SQL_FENCE_RE = re.compile(r"```(?:sql)?\s*([\s\S]*?)```", re.IGNORECASE)


# def _build_sync_db_url() -> str:
#     target_url = settings.SQL_QUERY_DATABASE_URL or settings.DATABASE_URL
#     # Switch asyncpg driver to psycopg2 for sync execution
#     sync_url = target_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
#     # The app uses the session-mode pooler (port 5432) which caps at 15 connections.
#     # Switch to the transaction-mode pooler (port 6543) for short-lived SQL queries.
#     sync_url = sync_url.replace(":5432/", ":6543/")
#     # Supabase requires SSL
#     if "sslmode" not in sync_url:
#         sep = "&" if "?" in sync_url else "?"
#         sync_url = sync_url + sep + "sslmode=require"
#     return sync_url


# def _block_dangerous_sql(text: str) -> None:
#     if _BLOCKED_KEYWORDS.search(text):
#         raise HTTPException(
#             status_code=400,
#             detail={
#                 "error": "forbidden_query",
#                 "message": "Queries that modify data are not permitted.",
#             },
#         )


# def _extract_sql(raw: str) -> str:
#     """Extract the SQL statement from an LLM response.

#     Handles: plain SQL, ```sql fenced, ``` fenced, or SQL preceded by explanation text.
#     """
#     # Try code fence first
#     m = _SQL_FENCE_RE.search(raw)
#     if m:
#         return m.group(1).strip()

#     # Walk lines and collect from the first SELECT onwards
#     lines = raw.strip().splitlines()
#     sql_lines: list[str] = []
#     collecting = False
#     for line in lines:
#         if not collecting and re.search(r"\bSELECT\b", line, re.IGNORECASE):
#             collecting = True
#         if collecting:
#             sql_lines.append(line)

#     if sql_lines:
#         return "\n".join(sql_lines).strip()

#     # Last resort: return stripped raw
#     return raw.strip()


# def _run_nl_to_sql(question: str, user_email: str) -> dict[str, Any]:
#     """Two-step NL→SQL pipeline executed inside asyncio.to_thread()."""
#     db = SQLDatabase.from_uri(_build_sync_db_url())
#     table_info = db.get_table_info()

#     # ── Step 1: Generate SQL ──────────────────────────────────────────────────
#     sql_prompt = f"""You are a PostgreSQL expert. Write a single SQL SELECT query to answer the question below.

# DATABASE SCHEMA:
# {table_info}

# QUESTION: {question}

# RULES:
# - Output ONLY the raw SQL query — no markdown, no explanation, no code fences
# - Only SELECT statements are allowed
# - Use exact table and column names from the schema

# SQL:"""

#     sql_response = llm.invoke(
#         [HumanMessage(content=sql_prompt)],
#         config={"metadata": {"user_email": user_email}},
#     )
#     print(f"[sql_service] raw_sql_response={repr(sql_response.content[:400])}")  # debug
#     generated_sql = _extract_sql(sql_response.content)
#     print(f"[sql_service] generated_sql={repr(generated_sql[:200])}")  # debug

#     # Safety check on generated SQL
#     _block_dangerous_sql(generated_sql)

#     # ── Step 2: Execute SQL ───────────────────────────────────────────────────
#     try:
#         raw_result = db.run(generated_sql)
#         print(f"[sql_service] raw_result={repr(str(raw_result)[:300])}")  # debug
#     except Exception as exc:
#         raise HTTPException(
#             status_code=500,
#             detail={"error": "sql_execution_error", "message": str(exc)},
#         ) from exc

#     # ── Step 3: Format result ─────────────────────────────────────────────────
#     format_prompt = f"""Convert the database result below into clean markdown.

# USER QUESTION: {question}

# RAW DATABASE RESULT:
# {raw_result}

# OUTPUT RULES — follow every rule, no exceptions:
# 1. Start with one sentence summarising the result.
# 2. Then output a blank line.
# 3. Then a GitHub-flavored markdown table with ALL rows and clear column headers.
# 4. Shorten UUIDs to first 8 chars + "…". Format timestamps as YYYY-MM-DD HH:MM.
# 5. NEVER write "email: X, full_name: Y" style inline text.
# 6. If only a single value was returned, write one sentence only (no table).

# Output ONLY the formatted markdown — no preamble, no code fences around the table."""

#     format_response = llm.invoke(
#         [HumanMessage(content=format_prompt)],
#         config={"metadata": {"user_email": user_email}},
#     )
#     answer = format_response.content.strip()

#     return {
#         "answer": answer,
#         "generated_sql": generated_sql,
#     }


# async def query_database(question: str, user_email: str) -> dict[str, Any]:
#     """Translate a natural-language question to SQL and return the answer."""
#     _block_dangerous_sql(question)
#     return await asyncio.to_thread(_run_nl_to_sql, question, user_email)


"""
NL-to-SQL service — read-only natural language query against a target database.

Two-step approach:
1. LLM generates a SQL SELECT query
2. Execute SQL and format the result

This guarantees generated SQL is always captured.
"""

import asyncio
import re
import traceback
from typing import Any

from fastapi import HTTPException
from langchain_community.utilities import SQLDatabase
from langchain_core.messages import HumanMessage

from app.ai.llm import llm
from app.core.config import settings


# ──────────────────────────────────────────────────────────────────────────────
# Block dangerous SQL keywords
# ──────────────────────────────────────────────────────────────────────────────

_BLOCKED_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|EXEC|EXECUTE)\b",
    flags=re.IGNORECASE,
)

_SQL_FENCE_RE = re.compile(
    r"```(?:sql)?\s*([\s\S]*?)```",
    re.IGNORECASE,
)


# ──────────────────────────────────────────────────────────────────────────────
# Build sync database URL
# ──────────────────────────────────────────────────────────────────────────────

def _build_sync_db_url() -> str:
    print("DATABASE_URL =", settings.DATABASE_URL)
    print("SQL_QUERY_DATABASE_URL =", settings.SQL_QUERY_DATABASE_URL)

    sync_url = settings.SQL_QUERY_DATABASE_URL

    print("FINAL SQL URL =", sync_url)

    return sync_url


# ──────────────────────────────────────────────────────────────────────────────
# Block dangerous queries
# ──────────────────────────────────────────────────────────────────────────────

def _block_dangerous_sql(text: str) -> None:
    if _BLOCKED_KEYWORDS.search(text):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "forbidden_query",
                "message": "Queries that modify data are not permitted.",
            },
        )


# ──────────────────────────────────────────────────────────────────────────────
# Extract SQL from LLM response
# ──────────────────────────────────────────────────────────────────────────────

def _extract_sql(raw: str) -> str:
    """
    Extract SQL statement from LLM response.
    """

    # Try markdown SQL fence
    m = _SQL_FENCE_RE.search(raw)
    if m:
        return m.group(1).strip()

    # Otherwise detect SELECT onwards
    lines = raw.strip().splitlines()

    sql_lines: list[str] = []
    collecting = False

    for line in lines:
        if not collecting and re.search(r"\bSELECT\b", line, re.IGNORECASE):
            collecting = True

        if collecting:
            sql_lines.append(line)

    if sql_lines:
        return "\n".join(sql_lines).strip()

    return raw.strip()


# ──────────────────────────────────────────────────────────────────────────────
# Main NL → SQL pipeline
# ──────────────────────────────────────────────────────────────────────────────

def _run_nl_to_sql(question: str, user_email: str) -> dict[str, Any]:
    try:
        print("\n==============================")
        print("[sql_service] QUESTION:", question)

        # Connect DB
        db = SQLDatabase.from_uri(
            _build_sync_db_url(),
            engine_args={
                "pool_pre_ping": True,
                "pool_size": 1,
                "max_overflow": 0,
            }
        )

        # Read DB schema
        table_info = db.get_table_info()

        print("[sql_service] schema loaded")

        # ──────────────────────────────────────────────────────────────────
        # STEP 1 — Generate SQL
        # ──────────────────────────────────────────────────────────────────

        sql_prompt = f"""
You are a PostgreSQL expert.

Write a single SQL SELECT query to answer the question below.

DATABASE SCHEMA:
{table_info}

QUESTION:
{question}

RULES:
- Output ONLY raw SQL
- No markdown
- No explanation
- No code fences
- Only SELECT queries allowed
- Use exact table and column names

SQL:
"""

        sql_response = llm.invoke(
            [HumanMessage(content=sql_prompt)],
            config={"metadata": {"user_email": user_email}},
        )

        print(
            "[sql_service] raw_sql_response =",
            repr(sql_response.content[:500])
        )

        generated_sql = _extract_sql(sql_response.content)

        print("[sql_service] generated_sql =", generated_sql)

        # Block dangerous SQL
        _block_dangerous_sql(generated_sql)

        # ──────────────────────────────────────────────────────────────────
        # STEP 2 — Execute SQL
        # ──────────────────────────────────────────────────────────────────

        try:
            raw_result = db.run(generated_sql)

            print(
                "[sql_service] raw_result =",
                repr(str(raw_result)[:500])
            )

        except Exception as exc:
            print("[sql_service] SQL EXECUTION ERROR")
            print(traceback.format_exc())

            raise HTTPException(
                status_code=500,
                detail={
                    "error": "sql_execution_error",
                    "message": str(exc),
                },
            ) from exc

        # ──────────────────────────────────────────────────────────────────
        # STEP 3 — Format Result
        # ──────────────────────────────────────────────────────────────────

        format_prompt = f"""
Convert the database result below into clean markdown.

USER QUESTION:
{question}

RAW DATABASE RESULT:
{raw_result}

RULES:
1. Start with one summary sentence.
2. Add a blank line.
3. Then output a markdown table with ALL rows.
4. Shorten UUIDs to first 8 chars + "…"
5. Format timestamps as YYYY-MM-DD HH:MM
6. If only one value exists, return one sentence only.
7. No code fences.

OUTPUT:
"""

        format_response = llm.invoke(
            [HumanMessage(content=format_prompt)],
            config={"metadata": {"user_email": user_email}},
        )

        answer = format_response.content.strip()

        print("[sql_service] formatted_answer =", answer[:300])

        return {
            "answer": answer,
            "generated_sql": generated_sql,
        }

    except Exception:
        print("[sql_service] FULL ERROR")
        print(traceback.format_exc())

        return {
            "answer": (
                "SQL query failed. "
                "Please rephrase your question or "
                "check that the feature is configured."
            ),
            "generated_sql": None,
        }


# ──────────────────────────────────────────────────────────────────────────────
# Async wrapper
# ──────────────────────────────────────────────────────────────────────────────

async def query_database(
    question: str,
    user_email: str,
) -> dict[str, Any]:

    _block_dangerous_sql(question)

    return await asyncio.to_thread(
        _run_nl_to_sql,
        question,
        user_email,
    )