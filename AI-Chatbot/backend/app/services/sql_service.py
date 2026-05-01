"""
NL-to-SQL service — read-only natural language query against the application database.

Uses LangChain's SQL agent with a synchronous psycopg2 driver (AD-06).
Enforces keyword blocking for all DML and DDL statements.
"""
import re
from typing import Any

from fastapi import HTTPException
from langchain_community.agent_toolkits import SQLDatabaseToolkit, create_sql_agent
from langchain_community.utilities import SQLDatabase

from app.ai.llm import llm
from app.core.config import settings

# AD-06: LangChain SQLDatabase requires the synchronous psycopg2 driver
_BLOCKED_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b",
    flags=re.IGNORECASE,
)


def _build_sync_db_url() -> str:
    """Convert asyncpg URL to psycopg2 URL for LangChain SQLDatabase (AD-06)."""
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


def _get_sql_db() -> SQLDatabase:
    return SQLDatabase.from_uri(_build_sync_db_url())


def _block_dangerous_sql(question: str) -> None:
    if _BLOCKED_KEYWORDS.search(question):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "forbidden_query",
                "message": "Queries that modify data (INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER) are not permitted.",
            },
        )


async def query_database(question: str, user_email: str) -> dict[str, Any]:
    """Execute a natural language query and return the answer plus generated SQL."""
    _block_dangerous_sql(question)

    db = _get_sql_db()
    toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    agent = create_sql_agent(
        llm=llm,
        toolkit=toolkit,
        verbose=False,
        return_intermediate_steps=True,
    )

    result = agent.invoke(
        {"input": question},
        config={"metadata": {"user_email": user_email}},
    )

    # Extract the generated SQL from intermediate steps
    generated_sql = ""
    for step in result.get("intermediate_steps", []):
        action = step[0]
        if hasattr(action, "tool") and action.tool == "sql_db_query":
            generated_sql = action.tool_input
            break

    # Block dangerous SQL found in generated queries (double-check)
    if _BLOCKED_KEYWORDS.search(generated_sql):
        raise HTTPException(
            status_code=400,
            detail={"error": "forbidden_query", "message": "Generated SQL contains disallowed operations."},
        )

    return {
        "answer": result.get("output", ""),
        "generated_sql": generated_sql,
    }
