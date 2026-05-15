"""
Google Sheets / CSV / Excel query router.
"""
import traceback
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.logging import logger
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import (
    SheetsFileQueryRequest,
    SheetsFileQueryResponse,
    SheetsQueryRequest,
    SheetsQueryResponse,
)
from app.services.sheets_service import query_dataframe_file, query_spreadsheet

router = APIRouter(prefix="/sheets", tags=["sheets"])


@router.post("/query", response_model=SheetsQueryResponse)
async def sheets_query(
    body: SheetsQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SheetsQueryResponse:
    try:
        result = await query_spreadsheet(
            spreadsheet_id=body.spreadsheet_id,
            question=body.question,
            user_email=current_user.email,
            user_id=current_user.id,
            thread_id=body.thread_id,
            db=db,
        )
        return SheetsQueryResponse(answer=result["answer"], thread_id=body.thread_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[sheets_query] Unhandled error:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={"error": "sheets_agent_error", "message": str(exc)},
        )


@router.post("/query-file", response_model=SheetsFileQueryResponse)
async def sheets_query_file(
    body: SheetsFileQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SheetsFileQueryResponse:
    try:
        result = await query_dataframe_file(
            file_id=body.file_id,
            question=body.question,
            user_email=current_user.email,
            user_id=current_user.id,
            thread_id=body.thread_id,
            db=db,
        )
        return SheetsFileQueryResponse(answer=result["answer"], thread_id=body.thread_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[sheets_query_file] Unhandled error:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={"error": "sheets_agent_error", "message": str(exc)},
        )
