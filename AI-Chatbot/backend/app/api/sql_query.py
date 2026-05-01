"""
NL-to-SQL router.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ai import SQLQueryRequest, SQLQueryResponse
from app.services.sql_service import query_database

router = APIRouter(prefix="/sql", tags=["sql"])


@router.post("/query", response_model=SQLQueryResponse)
async def sql_query(
    body: SQLQueryRequest,
    current_user: User = Depends(get_current_user),
) -> SQLQueryResponse:
    result = await query_database(body.question, current_user.email)
    return SQLQueryResponse(
        answer=result["answer"],
        generated_sql=result["generated_sql"],
        thread_id=body.thread_id,
    )
