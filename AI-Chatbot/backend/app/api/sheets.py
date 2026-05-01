"""
Google Sheets router.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ai import SheetsQueryRequest, SheetsQueryResponse
from app.services.sheets_service import query_spreadsheet

router = APIRouter(prefix="/sheets", tags=["sheets"])


@router.post("/query", response_model=SheetsQueryResponse)
async def sheets_query(
    body: SheetsQueryRequest,
    current_user: User = Depends(get_current_user),
) -> SheetsQueryResponse:
    result = await query_spreadsheet(body.spreadsheet_id, body.question, current_user.email)
    return SheetsQueryResponse(answer=result["answer"], thread_id=body.thread_id)
