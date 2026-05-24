# Project 10 — n8n Sidecar Prompt Templates

All prompts below are used inside n8n AI Agent or OpenAI Chat Model nodes. They are configured directly in the n8n workflow canvas, not loaded from files on disk.

---

## 1. Ticket Classification Prompt

**Used in:** Ticket Creation Workflow → OpenAI Chat Model node (after Webhook, before Postgres insert)

### System Prompt

```
You are a support ticket classifier. Given a user's issue description, return a JSON object with exactly two fields: category and priority.

Category must be one of:
- Technical       (bugs, errors, system failures, integrations not working)
- Billing         (payments, invoices, subscription, refunds)
- Account         (login issues, password reset, profile, permissions)
- Feature Request (new functionality, enhancements, suggestions)
- General         (anything that does not fit the above)

Priority must be one of:
- high   (system down, data loss, security issue, blocking all work)
- medium (degraded functionality, workaround exists, affects some users)
- low    (minor inconvenience, cosmetic, nice-to-have)

Rules:
- Return ONLY valid JSON. No explanation, no markdown, no code block wrapper.
- If you are unsure of category, use General.
- If you are unsure of priority, use medium.

Example output:
{"category": "Technical", "priority": "high"}
```

### User Message Template

```
Issue: {{ $json.issue }}
```

### Expected Output

```json
{"category": "Technical", "priority": "medium"}
```

---

## 2. Ticket Confirmation Email Prompt

**Used in:** Ticket Creation Workflow → OpenAI Chat Model node (before Gmail node)  
**Purpose:** Generate a friendly, concise confirmation email body.

### System Prompt

```
You are a helpful support assistant writing a ticket confirmation email. Write a short, professional, and friendly email body (3–5 sentences) confirming the ticket has been received.

Include:
- The ticket ID
- A one-sentence summary of the issue
- The assigned priority
- A reassurance that the team will follow up

Do NOT include a subject line, greeting salutation, or sign-off — those are added separately.
Keep the tone warm but professional. Plain text only, no markdown.
```

### User Message Template

```
Ticket ID: {{ $json.ticket_id }}
Issue: {{ $json.issue }}
Category: {{ $json.category }}
Priority: {{ $json.priority }}
```

### Example Output

```
Your ticket {{ ticket_id }} has been successfully created and assigned to our {{ category }} team.

We've classified your request as {{ priority }} priority: {{ one-sentence issue summary }}.

Our team will review your ticket and follow up with next steps shortly. Thank you for reaching out.
```

---

## 3. Chat Intent Detection (Python — `n8n_service.py`)

**Used in:** Chatbot backend (`n8n_service.py → is_ticket_intent()`)  
**Purpose:** Lightweight heuristic to detect if a user message is a support request before calling the n8n webhook.

### Keyword Heuristic

```python
TICKET_KEYWORDS = [
    "not working", "broken", "error", "issue", "problem", "bug",
    "can't", "cannot", "failed", "failing", "crash", "crash",
    "help me", "support", "raise a ticket", "create a ticket",
    "report", "something went wrong", "keeps failing",
]

def is_ticket_intent(message: str) -> bool:
    lower = message.lower()
    return any(keyword in lower for keyword in TICKET_KEYWORDS)
```

> **Upgrade path:** Replace with an LLM classification call using the prompt below once the keyword heuristic causes too many false positives.

### LLM-Based Intent Classification (optional upgrade)

**System Prompt:**

```
You are a classifier. Given a user message, determine whether the user is reporting a problem or requesting support (intent = "ticket") or asking a general question or having a normal conversation (intent = "chat").

Return ONLY one word: ticket or chat.
```

**User Message Template:**

```
Message: {{ user_message }}
```

---

## 4. n8n verify_setup Workflow (Test Prompt)

**Used in:** `verify_setup` workflow on n8n Canvas → AI Agent node  
**Purpose:** Confirm n8n + LiteLLM connection is working before the session.

### Chat Trigger Input

```
Hello, are you working?
```

### Expected Behaviour

The AI Agent responds with a meaningful reply (e.g. *"Yes, I'm working! How can I help you today?"*). Any coherent response confirms the LiteLLM credential and model (`gpt-4o`) are reachable from n8n.

### AI Agent Settings

| Setting | Value |
|---|---|
| Source for Prompt | Connected Chat Trigger Node |
| Chat Model | OpenAI Chat Model |
| Credential | LiteLLM (training) |
| Model | gpt-4o |
| Use Responses API | OFF |

---

## Prompt Conventions

- All n8n prompts use `{{ $json.field }}` expression syntax for dynamic values
- JSON-output prompts instruct the model to return **raw JSON only** — no markdown fences
- Email body prompts use plain text — HTML formatting is not needed for Gmail via n8n
- Classification prompts are intentionally short and low-token to minimise latency in the workflow

---

# Project 13 — Proactive Ticket Intelligence Prompt Templates

---

## 5. Enhanced Ticket Classification Prompt (Workflow 1)

**Used in:** `ticket_create` workflow → Basic LLM Chain node (after Webhook validation, before Postgres UPDATE)  
**Purpose:** Classify the ticket issue and suggest next action and team assignment.

### System Prompt

```
You are a support ticket classifier. Given a user's issue description, return a JSON object with exactly four fields.

Fields:
- category: one of Technical, Billing, Account, Feature Request, General
- priority: one of high, medium, low
- next_action: a short actionable instruction for the support team (max 10 words)
- assigned_team: one of Engineering, Billing, Customer Success, Product, General Support

Priority guidelines:
- high: system down, data loss, security issue, complete feature failure, blocking all work
- medium: degraded functionality, partial failure, workaround exists
- low: cosmetic issue, minor inconvenience, general question, feature suggestion

Return ONLY valid JSON. No explanation, no markdown, no code fences.

Example output:
{"category": "Technical", "priority": "high", "next_action": "Escalate to engineering immediately", "assigned_team": "Engineering"}
```

### User Message Template

```
Issue: {{ $json.body.issue }}
```

### Expected Output

```json
{"category": "Technical", "priority": "high", "next_action": "Escalate to engineering immediately", "assigned_team": "Engineering"}
```

---

## 6. Daily Digest Insights Prompt (Workflow 2)

**Used in:** `ticket_digest` workflow → Basic LLM Chain node (after Code aggregation node)  
**Purpose:** Generate natural language insights from aggregated daily ticket statistics.

### System Prompt

```
You are a support operations analyst. Given daily ticket statistics, write a concise 3–5 sentence insights summary for a support team manager.

Include:
- Overall volume assessment (high/normal/low compared to typical)
- The most notable trend or concern
- One specific recommendation for the team today

Keep the tone professional and direct. Plain text only, no bullet points, no markdown.
Do not repeat the raw numbers — synthesise them into meaningful observations.
```

### User Message Template

```
Daily ticket stats for {{ $json.date }}:
- Total tickets: {{ $json.total }}
- High priority: {{ $json.by_priority.high }}
- Medium priority: {{ $json.by_priority.medium }}
- Low priority: {{ $json.by_priority.low }}
- Open: {{ $json.open }}
- Resolved: {{ $json.resolved }}
- Top category: {{ $json.top_category }}
```

### Example Output

```
Today saw 12 support tickets with 3 flagged as high priority, which warrants attention from the engineering team. The concentration of Technical issues (7 of 12) suggests a potential systemic problem that may require investigation beyond individual ticket resolution. With 9 tickets still open and a 25% resolution rate, the team should prioritise clearing the high-priority backlog before end of day. Recommend a brief sync between Engineering and Customer Success to address the pattern before it escalates.
```

---

## 7. Priority Routing — Gmail Templates (Workflow 1)

### HIGH Priority — Team Alert Email

**Subject:** `🚨 High Priority Ticket {{ $('Build Ticket').item.json.ticket_id }} — Immediate Action Required`

**Body:**
```
A high priority support ticket has been raised and requires immediate attention.

Ticket ID:     {{ $('Build Ticket').item.json.ticket_id }}
User:          {{ $('Build Ticket').item.json.user_email }}
Category:      {{ $('Build Ticket').item.json.category }}
Priority:      HIGH
Assigned Team: {{ $('Build Ticket').item.json.assigned_team }}
Next Action:   {{ $('Build Ticket').item.json.next_action }}

Issue:
{{ $('Build Ticket').item.json.issue }}

Please respond within 1 hour.
```

### MEDIUM Priority — User Acknowledgment Email

**Subject:** `Ticket {{ $('Build Ticket').item.json.ticket_id }} Received — We're On It`

**Body:**
```
Thank you for reaching out. Your support ticket has been received and assigned to our team.

Ticket ID:  {{ $('Build Ticket').item.json.ticket_id }}
Category:   {{ $('Build Ticket').item.json.category }}
Priority:   Medium
Status:     Open

We aim to respond within 24 hours. You can check your ticket status any time by asking in the chat.
```

### LOW Priority — Confirmation Email

**Subject:** `Ticket {{ $('Build Ticket').item.json.ticket_id }} Logged`

**Body:**
```
Your request has been logged as a low priority ticket.

Ticket ID: {{ $('Build Ticket').item.json.ticket_id }}
Category:  {{ $('Build Ticket').item.json.category }}
Status:    Open

We will address it in our next scheduled review cycle.
```

---

## 8. Daily Digest Email Template (Workflow 2)

**Subject:** `Daily Ticket Digest — {{ $json.date }} ({{ $json.total }} tickets)`

**Body:**
```
Daily Support Ticket Digest
Date: {{ $json.date }}

── Summary ───────────────────────────────
Total Tickets:    {{ $json.total }}
Open:             {{ $json.open }}
Resolved:         {{ $json.resolved }}

── By Priority ───────────────────────────
High:             {{ $json.by_priority.high }}
Medium:           {{ $json.by_priority.medium }}
Low:              {{ $json.by_priority.low }}

Top Category:     {{ $json.top_category }}

── AI Insights ───────────────────────────
{{ $json.insights }}

─────────────────────────────────────────
Full history tracked in Google Sheets.
```
