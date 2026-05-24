from pydantic import BaseModel


class RAGQueryRequest(BaseModel):
    thread_id: str
    query: str
    file_ids: list[str] = []


class ImageGenerateRequest(BaseModel):
    prompt: str
    thread_id: str


class ImageGenerateResponse(BaseModel):
    image_url: str
    thread_id: str


class SQLQueryRequest(BaseModel):
    thread_id: str
    question: str


class SQLQueryResponse(BaseModel):
    answer: str
    generated_sql: str | None = None
    thread_id: str


class SheetsQueryRequest(BaseModel):
    spreadsheet_id: str
    question: str
    thread_id: str


class SheetsQueryResponse(BaseModel):
    answer: str
    thread_id: str


class SheetsFileQueryRequest(BaseModel):
    file_id: str
    question: str
    thread_id: str


class SheetsFileQueryResponse(BaseModel):
    answer: str
    thread_id: str


class ResearchDigestRequest(BaseModel):
    thread_id: str
    query: str
    max_papers: int = 10


class TicketCreateRequest(BaseModel):
    issue: str
    thread_id: str


class TicketCreateResponse(BaseModel):
    ticket_id: str
    status: str
    category: str
    priority: str
    message: str
    next_action: str | None = None
    assigned_team: str | None = None


class TicketStatusRequest(BaseModel):
    ticket_id: str


class TicketStatusResponse(BaseModel):
    ticket_id: str
    status: str
    category: str
    priority: str
    created_at: str
    next_action: str | None = None
    assigned_team: str | None = None
