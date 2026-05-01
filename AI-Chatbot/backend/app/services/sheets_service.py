"""
Google Sheets service — reads data from a spreadsheet and answers questions using a Pandas agent.
"""
import json
from typing import Any

import gspread
import pandas as pd
from fastapi import HTTPException
from google.oauth2.service_account import Credentials
from langchain_experimental.agents import create_pandas_dataframe_agent

from app.ai.llm import llm
from app.core.config import settings
from app.core.logging import logger

_SCOPES = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]


def _get_gspread_client() -> gspread.Client:
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise HTTPException(
            status_code=503,
            detail={"error": "sheets_not_configured", "message": "Google Sheets integration is not configured."},
        )
    creds_dict = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = Credentials.from_service_account_info(creds_dict, scopes=_SCOPES)
    return gspread.authorize(creds)


async def query_spreadsheet(
    spreadsheet_id: str,
    question: str,
    user_email: str,
) -> dict[str, Any]:
    """Load a Google Sheet into a DataFrame and run an agent to answer the question."""
    try:
        client = _get_gspread_client()
        sheet = client.open_by_key(spreadsheet_id).sheet1
        df = pd.DataFrame(sheet.get_all_records())
    except Exception as e:
        logger.error("Failed to load Google Sheet %s: %s", spreadsheet_id, e)
        raise HTTPException(
            status_code=502,
            detail={"error": "sheets_error", "message": str(e)},
        )

    agent = create_pandas_dataframe_agent(
        llm=llm,
        df=df,
        verbose=False,
        return_intermediate_steps=True,
        allow_dangerous_code=True,
    )

    result = agent.invoke(
        {"input": question},
        config={"metadata": {"user_email": user_email}},
    )

    return {"answer": result.get("output", "")}
