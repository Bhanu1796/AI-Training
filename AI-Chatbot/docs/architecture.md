# Project 10 — n8n Sidecar Architecture

## System Overview

```
Browser (React)
     │  POST /api/chat/message (normal chat flow)
     ▼
FastAPI Backend (AI-Chatbot)
     │
     ├── chat_service.py ──► detect ticket intent
     │                              │
     │                              ▼
     │                   n8n_service.py
     │                              │
     │           POST N8N_WEBHOOK_URL (x-n8n-api-key header)
     │                              │
     ▼                              ▼
Supabase DB              n8n Cloud Workflow Engine
(tickets table)                     │
                         ┌──────────┼───────────────┐
                         ▼          ▼               ▼
                   LiteLLM Proxy  Postgres       Gmail
                   (categorise    (insert        (send
                    + prioritise)  ticket)        confirmation)
```

---

## n8n Workflows

### Workflow 1 — Ticket Creation

```
Webhook (POST)
     │  { user_email, issue, thread_id }
     ▼
Set Node — generate ticket_id (TKT-YYYYMMDD-XXXX)
     ▼
OpenAI Chat Model (LiteLLM credential)
     │  Classify: category + priority from issue text
     ▼
Postgres Node — INSERT INTO tickets (...)
     ▼
Gmail Node — send confirmation email to user_email
     ▼
Respond to Webhook — { ticket_id, status, category, priority }
```

**Webhook URL:** activated after workflow is deployed → stored in `N8N_WEBHOOK_URL`

---

### Workflow 2 — Ticket Status Lookup

```
Webhook (POST)
     │  { ticket_id }
     ▼
Postgres Node — SELECT * FROM tickets WHERE ticket_id = :ticket_id
     ▼
Respond to Webhook — { ticket_id, status, category, priority, created_at, next_action }
```

**Webhook URL:** activated after workflow is deployed → stored in `N8N_STATUS_WEBHOOK_URL`

---

## Backend Integration

### New Files

| File | Purpose |
|---|---|
| `app/services/n8n_service.py` | HTTP calls to n8n webhooks, intent detection helper |
| `app/api/n8n.py` | Optional inbound endpoints if n8n needs to call back into the app |
| `app/models/ticket.py` | SQLAlchemy ORM model for `tickets` (read-only from app side) |

### `n8n_service.py` — Key Functions

```python
async def create_ticket(user_email: str, issue: str, thread_id: str) -> dict:
    """POST to N8N_WEBHOOK_URL — returns { ticket_id, status, category, priority }"""

async def get_ticket_status(ticket_id: str) -> dict:
    """POST to N8N_STATUS_WEBHOOK_URL — returns ticket row"""

def is_ticket_intent(message: str) -> bool:
    """Heuristic: detect if user message is a support request"""
```

### Integration Point in `chat_service.py`

```
stream_chat_response()
     │
     ├── is_ticket_intent(message)?
     │        │ YES
     │        └──► create_ticket() → n8n webhook
     │                  │
     │                  └──► stream ticket confirmation to user
     │
     └── normal chat flow
```

---

## Database

### `tickets` Table (Supabase — manual, not Alembic)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `ticket_id` | text | Unique, human-readable (TKT-...) |
| `user_email` | text | From JWT claim |
| `issue` | text | Raw user message |
| `category` | text | LLM-assigned (default: 'General') |
| `priority` | text | LLM-assigned: low / medium / high |
| `status` | text | open / in-progress / resolved |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto |
| `thread_id` | text | Links ticket to chat thread |
| `assigned_team` | text | Optional, set by n8n |
| `next_action` | text | Optional, set by n8n |

```sql
CREATE TABLE IF NOT EXISTS tickets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    text        UNIQUE NOT NULL,
  user_email   text        NOT NULL,
  issue        text        NOT NULL,
  category     text        NOT NULL DEFAULT 'General',
  priority     text        NOT NULL DEFAULT 'medium',
  status       text        NOT NULL DEFAULT 'open',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  thread_id    text,
  assigned_team text,
  next_action  text
);
```

> **Note:** This table is NOT created by Alembic migrations. Create it manually via Supabase SQL Editor.

---

## n8n Credentials Required

| Credential Name | Type | Source |
|---|---|---|
| LiteLLM (training) | OpenAI | `LITELLM_API_KEY` + `LITELLM_PROXY_URL/v1` |
| Postgres (training) | PostgreSQL | Supabase pooler, port 6543 |
| Gmail (training) | Gmail OAuth2 | Google Cloud OAuth client (chatbot project) |

---

## Environment Variables

```env
# n8n automation sidecar (fill in after activating workflows in session)
N8N_WEBHOOK_URL=
N8N_API_KEY=
N8N_STATUS_WEBHOOK_URL=
```

All three are optional at boot — the app starts cleanly with blank values.

---

## Security

- All n8n webhook calls include `x-n8n-api-key: {N8N_API_KEY}` header
- `user_email` is taken from the authenticated JWT — never from user input
- `thread_id` is validated against the authenticated user's threads before being passed to n8n
- n8n Postgres credential uses the **transaction pooler** (port 6543) — not direct connection

---

## Key Conventions

- n8n calls are **fire-and-respond** — webhook returns synchronously with ticket data
- If `N8N_WEBHOOK_URL` is blank, ticket creation silently falls back to a local acknowledgement message
- `is_ticket_intent()` uses keyword heuristics; can be upgraded to LLM classification later
- The `tickets` table is owned by n8n workflows — the chatbot app only reads it

---

# Project 13 — Proactive Ticket Intelligence Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW 1 — Real-time (Webhook)             │
│                                                                 │
│  Chatbot Backend                                                │
│       │  POST N8N_WEBHOOK_URL                                   │
│       │  { ticket_id, user_email, issue, thread_id }            │
│       ▼                                                         │
│  [Webhook] → [Validate] → [LiteLLM Classify]                   │
│                                  │                              │
│                            ERROR BRANCH                         │
│                            (LLM fails)                          │
│                                  │           ▼                  │
│                            [Default medium] [Alert Email]       │
│                                  │                              │
│                          [Postgres UPDATE]                      │
│                                  │                              │
│                           [Switch: priority]                    │
│                          ┌───────┼────────┐                    │
│                        HIGH   MEDIUM    LOW                     │
│                          │       │        │                     │
│                    [Team Alert][Ack Email][Confirm]             │
│                          └───────┴────────┘                    │
│                                  │                              │
│                      [Respond to Webhook]                       │
│                  { ticket_id, status, category, priority }      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              WORKFLOW 2 — Daily Digest (Schedule 9 AM)          │
│                                                                 │
│  [Schedule Trigger: 9 AM Mon–Fri]                               │
│       ▼                                                         │
│  [Postgres SELECT — last 24h tickets]                           │
│       ▼                                                         │
│  [Code Node — aggregate by category + priority]                 │
│       ▼                                                         │
│  [LiteLLM — generate natural language insights]                 │
│       │                                                         │
│  ERROR BRANCH (LLM fails)                                       │
│       ▼                          ▼                              │
│  [Gmail digest with AI summary]  [Gmail digest raw table only]  │
│       ▼                                                         │
│  [Google Sheets — append daily stats row]                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow 1 — Ticket Processing (Webhook)

### Node Breakdown

| Step | Node Type | Purpose |
|---|---|---|
| 1 | Webhook | Receive POST from chatbot `n8n_service.py` |
| 2 | Code | Validate: user_email + issue not blank; return 400 if invalid |
| 3 | Basic LLM Chain | Classify category, priority, next_action, assigned_team |
| 4 | IF (error branch) | If LLM output is unparseable → default values + alert |
| 5 | Postgres | UPDATE tickets SET category, priority, next_action, assigned_team |
| 6 | Switch | Branch on priority: high / medium / low |
| 7a | Gmail (HIGH) | Send immediate alert to support team email |
| 7b | Gmail (MEDIUM) | Send standard acknowledgment to user |
| 7c | Gmail (LOW) | Send brief confirmation to user |
| 8 | Respond to Webhook | Return `{ ticket_id, status, category, priority, next_action }` |

### Data Flow

```
Input (from chatbot):
{ ticket_id, user_email, issue, thread_id }

After LLM Classification:
{ category: "Technical", priority: "high", next_action: "Escalate to engineering", assigned_team: "Engineering" }

Postgres UPDATE:
UPDATE tickets
SET category='Technical', priority='high', next_action='...', assigned_team='Engineering', status='urgent'
WHERE ticket_id = '{{ $json.ticket_id }}'

Webhook Response:
{ ticket_id: "TKT-20260523-AB12CD", status: "urgent", category: "Technical", priority: "high", next_action: "Escalate to engineering" }
```

---

## Workflow 2 — Daily Digest (Schedule)

### Node Breakdown

| Step | Node Type | Purpose |
|---|---|---|
| 1 | Schedule Trigger | 9 AM Mon–Fri cron |
| 2 | Postgres | SELECT tickets WHERE created_at >= now() - interval '24 hours' |
| 3 | Code | Aggregate: count by category, count by priority, total open/resolved |
| 4 | Basic LLM Chain | Generate 3–5 sentence natural language insights from the stats |
| 5 | IF (error branch) | If LLM fails → skip insights, use raw table only |
| 6 | Gmail | Send formatted HTML digest email with summary table + AI insights |
| 7 | Google Sheets | Append one row: date, totals, high/medium/low counts, top category |

### Data Transformation (Code Node)

```javascript
// Input: array of ticket rows from Postgres
// Output: aggregated summary object

const tickets = $input.all().map(t => t.json);

const summary = {
  total: tickets.length,
  by_priority: { high: 0, medium: 0, low: 0 },
  by_category: {},
  open: 0,
  resolved: 0,
  date: new Date().toISOString().slice(0, 10)
};

for (const t of tickets) {
  summary.by_priority[t.priority] = (summary.by_priority[t.priority] || 0) + 1;
  summary.by_category[t.category] = (summary.by_category[t.category] || 0) + 1;
  if (t.status === 'resolved') summary.resolved++;
  else summary.open++;
}

summary.top_category = Object.entries(summary.by_category)
  .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

return [{ json: summary }];
```

### Google Sheets Row Schema

| Column | Value |
|---|---|
| Date | 2026-05-23 |
| Total Tickets | 12 |
| High Priority | 3 |
| Medium Priority | 7 |
| Low Priority | 2 |
| Open | 9 |
| Resolved | 3 |
| Top Category | Technical |

---

## Additional Environment Variable

```env
N8N_DIGEST_SHEET_ID=   # Google Sheets spreadsheet ID for daily digest
```

---

## New Workflow Files

| File | Purpose |
|---|---|
| `docs/n8n-workflows/ticket_create.json` | Webhook + LLM + Switch routing + Gmail + Postgres UPDATE |
| `docs/n8n-workflows/ticket_digest.json` | Schedule + Postgres + Code + LLM + Gmail + Sheets |
