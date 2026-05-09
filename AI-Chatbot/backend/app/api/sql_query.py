# """
# NL-to-SQL router — translates natural language to SQL and persists the exchange.
# """
# import uuid

# from fastapi import APIRouter, Depends
# from sqlalchemy.ext.asyncio import AsyncSession

# from app.api.deps import get_current_user
# from app.db.session import get_db
# from app.models.user import User
# from app.schemas.ai import SQLQueryRequest, SQLQueryResponse
# from app.services.chat_service import save_message
# from app.services.sql_service import query_database

# router = APIRouter(prefix="/sql", tags=["sql"])


# @router.post("/query", response_model=SQLQueryResponse)
# async def sql_query(
#     body: SQLQueryRequest,
#     current_user: User = Depends(get_current_user),
#     db: AsyncSession = Depends(get_db),
# ) -> SQLQueryResponse:
#     import traceback
#     try:
#         result = await query_database(body.question, current_user.email)

#         thread_uuid = uuid.UUID(body.thread_id)

#         # Build the full display content (SQL block first, then result)
#         if result["generated_sql"]:
#             full_content = (
#                 f"**Generated SQL**\n```sql\n{result['generated_sql']}\n```\n\n---\n\n{result['answer']}"
#             )
#         else:
#             full_content = result["answer"]

#         # Persist both sides of the conversation
#         await save_message(db, thread_uuid, current_user.id, "user", body.question)
#         await save_message(db, thread_uuid, current_user.id, "assistant", full_content)
#         await db.commit()

#         # Return full_content so the frontend can display it directly without rebuilding
#         return SQLQueryResponse(
#             answer=full_content,
#             generated_sql=result["generated_sql"],
#             thread_id=body.thread_id,
#         )
#     except Exception:
#         print(f"[sql_query] ERROR:\n{traceback.format_exc()}")
#         raise


"""
NL-to-SQL router — translates natural language to SQL and persists the exchange.
"""
import uuid
import traceback

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import SQLQueryRequest, SQLQueryResponse
from app.services.chat_service import save_message
from app.services.sql_service import query_database

router = APIRouter(prefix="/sql", tags=["sql"])


@router.post("/query", response_model=SQLQueryResponse)
async def sql_query(
    body: SQLQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SQLQueryResponse:

    print("SQL ROUTE HIT")
    print("QUESTION:", body.question)

    try:
        # Generate SQL + execute query
        result = await query_database(body.question, current_user.email)

        print("RESULT:", result)

        # Convert thread id safely
        thread_uuid = uuid.UUID(body.thread_id)

        # Safely get generated SQL
        generated_sql = result.get("generated_sql")

        print("GENERATED SQL:", generated_sql)

        # Build assistant response content
        if generated_sql:
            full_content = (
                f"**Generated SQL**\n"
                f"```sql\n{generated_sql}\n```\n\n"
                f"---\n\n"
                f"{result['answer']}"
            )
        else:
            full_content = result.get(
                "answer",
                "No response generated."
            )

        print("FULL CONTENT:", full_content[:300])

        # Save user message
        await save_message(
            db,
            thread_uuid,
            current_user.id,
            "user",
            body.question
        )

        # Save assistant response
        await save_message(
            db,
            thread_uuid,
            current_user.id,
            "assistant",
            full_content
        )

        # Commit transaction
        await db.commit()

        print("RETURNING RESPONSE")

        # Return response to frontend
        return SQLQueryResponse(
            answer=full_content,
            generated_sql=generated_sql,
            thread_id=body.thread_id,
        )

    except Exception:
        print("[sql_query] ERROR:")
        print(traceback.format_exc())
        raise