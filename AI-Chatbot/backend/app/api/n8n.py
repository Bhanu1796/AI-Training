"""
n8n sidecar router — ticket creation and status lookup endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ai import (
    TicketCreateRequest,
    TicketCreateResponse,
    TicketStatusResponse,
)
from app.services.n8n_service import create_ticket, get_ticket_status

router = APIRouter(prefix="/n8n", tags=["n8n"])


@router.post("/tickets", response_model=TicketCreateResponse, status_code=status.HTTP_201_CREATED)
async def submit_ticket(
    body: TicketCreateRequest,
    current_user: User = Depends(get_current_user),
) -> TicketCreateResponse:
    """Create a support ticket via the n8n automation workflow."""
    try:
        result = await create_ticket(
            user_email=current_user.email,
            issue=body.issue,
            thread_id=body.thread_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"n8n ticket creation failed: {exc}",
        ) from exc

    return TicketCreateResponse(
        ticket_id=result.get("ticket_id", "UNKNOWN"),
        status=result.get("status", "open"),
        category=result.get("category", "General"),
        priority=result.get("priority", "medium"),
        message=f"Ticket {result.get('ticket_id', 'UNKNOWN')} created. "
                f"A confirmation email has been sent to {current_user.email}.",
    )


@router.get("/tickets/{ticket_id}", response_model=TicketStatusResponse)
async def ticket_status(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
) -> TicketStatusResponse:
    """Look up the status of an existing support ticket."""
    try:
        result = await get_ticket_status(ticket_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"n8n status lookup failed: {exc}",
        ) from exc

    return TicketStatusResponse(
        ticket_id=result.get("ticket_id", ticket_id),
        status=result.get("status", "unknown"),
        category=result.get("category", "General"),
        priority=result.get("priority", "medium"),
        created_at=str(result.get("created_at", "")),
        next_action=result.get("next_action"),
        assigned_team=result.get("assigned_team"),
    )
