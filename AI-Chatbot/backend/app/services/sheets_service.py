"""
Google Sheets / CSV / Excel service — loads tabular data into a Pandas DataFrame and
answers natural-language questions using a LangChain Pandas DataFrame agent.

Two entry points:
  query_spreadsheet()   — loads from a Google Sheet (requires service account credentials)
  query_dataframe_file() — loads from an uploaded .csv / .xlsx / .xls file
"""
import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

import gspread
import pandas as pd
from fastapi import HTTPException
from langchain_experimental.agents import create_pandas_dataframe_agent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import llm
from app.core.config import settings
from app.core.logging import logger
from app.models.file import UploadedFile
from app.services.chat_service import save_message

_SCOPES = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]

# MIME types treated as CSV (plain text with no magic bytes)
_CSV_MIMES = {"text/csv", "text/plain"}
# MIME types treated as Excel
_EXCEL_MIMES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}


def _get_gspread_client() -> gspread.Client:
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise HTTPException(
            status_code=503,
            detail={"error": "sheets_not_configured", "message": "Google Sheets integration is not configured."},
        )
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    # gspread ≥ 6.x: gspread.authorize() removed — use service_account_from_dict()
    return gspread.service_account_from_dict(creds_dict, scopes=_SCOPES)


def load_sheet_as_dataframe(spreadsheet_url_or_id: str) -> pd.DataFrame:
    """
    Standalone utility for quick validation:

        from app.services.sheets_service import load_sheet_as_dataframe
        df = load_sheet_as_dataframe("<your-sheet-url>")
        print(len(df))  # must be non-zero
    """
    import re
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", spreadsheet_url_or_id)
    sheet_id = m.group(1) if m else spreadsheet_url_or_id.strip()
    client = _get_gspread_client()
    sheet = client.open_by_key(sheet_id).sheet1
    return pd.DataFrame(sheet.get_all_records())


def _run_pandas_agent(df: pd.DataFrame, question: str, user_email: str) -> str:
    """Run the Pandas DataFrame agent synchronously (called inside asyncio.to_thread)."""
    agent = create_pandas_dataframe_agent(
        llm=llm,
        df=df,
        verbose=False,
        return_intermediate_steps=False,
        allow_dangerous_code=True,
        # Do NOT set handle_parsing_errors=True — it leaks the raw error
        # message text into the agent output (Gemini echoes it verbatim).
        # We catch OutputParserException below and extract the content instead.
    )

    formatted_question = (
        f"{question}\n\n"
        "For your Final Answer: if the result has multiple rows or items, present it "
        "as a GitHub-flavored markdown table with a header row. "
        "For a single value, write one concise sentence. "
        "Never use comma-separated 'Name: value' text or Python repr."
    )

    try:
        result = agent.invoke(
            {"input": formatted_question},
            config={"metadata": {"user_email": user_email}},
        )
        return result.get("output", "")
    except Exception as exc:
        # The ReAct parser raises OutputParserException with the message:
        #   "Could not parse LLM output: `<actual content>`"
        # when the LLM generates a correct answer without the "Final Answer:"
        # prefix. Extract and return the content directly instead of failing.
        err_str = str(exc)
        marker = "Could not parse LLM output: `"
        if marker in err_str:
            raw = err_str[err_str.index(marker) + len(marker):]
            # Strip the closing backtick langchain appends to the message
            if raw.endswith("`"):
                raw = raw[:-1]
            extracted = raw.strip()
            if extracted:
                return extracted
        raise


async def query_spreadsheet(
    spreadsheet_id: str,
    question: str,
    user_email: str,
    user_id: uuid.UUID,
    thread_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Load a Google Sheet into a DataFrame and run an agent to answer the question."""
    try:
        client = _get_gspread_client()
        sheet = client.open_by_key(spreadsheet_id).sheet1
        df = pd.DataFrame(sheet.get_all_records())
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to load Google Sheet %s: %s", spreadsheet_id, e)
        raise HTTPException(
            status_code=502,
            detail={"error": "sheets_error", "message": str(e)},
        )

    answer = await asyncio.to_thread(_run_pandas_agent, df, question, user_email)

    # Persist both sides of the conversation
    thread_uuid = uuid.UUID(thread_id)
    await save_message(db, thread_uuid, user_id, "user", question)
    await save_message(db, thread_uuid, user_id, "assistant", answer)
    await db.commit()

    return {"answer": answer}


async def query_dataframe_file(
    file_id: str,
    question: str,
    user_email: str,
    user_id: uuid.UUID,
    thread_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Load an uploaded CSV / Excel file into a DataFrame and answer a natural-language question."""
    # Fetch file metadata and validate ownership
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == uuid.UUID(file_id),
            UploadedFile.user_id == user_id,
        )
    )
    db_file = result.scalar_one_or_none()
    if db_file is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "file_not_found", "message": "File not found or access denied."},
        )

    file_path = Path(db_file.stored_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=410,
            detail={"error": "file_missing", "message": "The uploaded file could not be found on disk."},
        )

    # Determine file format and load into DataFrame
    mime = db_file.mime_type
    ext = file_path.suffix.lower()
    try:
        if mime in _CSV_MIMES or ext == ".csv":
            df = pd.read_csv(str(file_path))
        elif mime in _EXCEL_MIMES or ext in (".xlsx", ".xls"):
            df = pd.read_excel(str(file_path))
        else:
            raise HTTPException(
                status_code=422,
                detail={"error": "unsupported_format", "message": f"Cannot query file of type '{mime}'. Upload a CSV or Excel file."},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to load data file %s: %s", file_id, e)
        raise HTTPException(
            status_code=500,
            detail={"error": "file_load_error", "message": f"Failed to read file: {e}"},
        )

    answer = await asyncio.to_thread(_run_pandas_agent, df, question, user_email)

    # Persist both sides of the conversation
    thread_uuid = uuid.UUID(thread_id)
    await save_message(db, thread_uuid, user_id, "user", question)
    await save_message(db, thread_uuid, user_id, "assistant", answer)
    await db.commit()

    return {"answer": answer, "filename": db_file.original_filename}
