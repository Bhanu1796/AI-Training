"""
n8n sidecar service — webhook calls for ticket creation and status lookup.
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Keywords that indicate the user is reporting a problem or requesting support
_TICKET_KEYWORDS = [
    "not working", "broken", "error", "issue", "problem", "bug",
    "can't", "cannot", "failed", "failing", "crash", "crashes",
    "help me", "support", "raise a ticket", "create a ticket",
    "report", "something went wrong", "keeps failing", "keeps crashing",
    "doesn't work", "does not work", "unable to", "stuck",
]


def is_ticket_intent(message: str) -> bool:
    """Return True if the message looks like a support/bug report."""
    lower = message.lower()
    return any(keyword in lower for keyword in _TICKET_KEYWORDS)


def _headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if settings.N8N_API_KEY:
        headers["x-n8n-api-key"] = settings.N8N_API_KEY
    return headers


async def create_ticket(user_email: str, issue: str, thread_id: str) -> dict:
    """
    POST to n8n ticket-creation webhook.
    Returns the response JSON from n8n (contains ticket_id, status, category, priority).
    Falls back gracefully if N8N_WEBHOOK_URL is not configured.
    """
    if not settings.N8N_WEBHOOK_URL:
        logger.warning("N8N_WEBHOOK_URL is not set — ticket creation skipped")
        return {
            "ticket_id": "PENDING",
            "status": "open",
            "category": "General",
            "priority": "medium",
        }

    payload = {
        "user_email": user_email,
        "issue": issue,
        "thread_id": thread_id,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            settings.N8N_WEBHOOK_URL,
            json=payload,
            headers=_headers(),
        )
        response.raise_for_status()
        if not response.content:
            raise ValueError(
                "n8n returned empty body — workflow errored before Respond node. "
                "Check Executions tab in n8n for the failing node."
            )
        return response.json()


async def get_ticket_status(ticket_id: str) -> dict:
    """
    POST to n8n status-lookup webhook.
    Returns the ticket row from Supabase via n8n.
    Falls back gracefully if N8N_STATUS_WEBHOOK_URL is not configured.
    """
    if not settings.N8N_STATUS_WEBHOOK_URL:
        logger.warning("N8N_STATUS_WEBHOOK_URL is not set — status lookup skipped")
        return {
            "ticket_id": ticket_id,
            "status": "unknown",
            "category": "General",
            "priority": "medium",
            "created_at": "",
        }

    payload = {"ticket_id": ticket_id}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            settings.N8N_STATUS_WEBHOOK_URL,
            json=payload,
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()
