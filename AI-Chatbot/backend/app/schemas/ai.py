from pydantic import BaseModel


class RAGQueryRequest(BaseModel):
    thread_id: str
    query: str


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
    generated_sql: str
    thread_id: str


class SheetsQueryRequest(BaseModel):
    spreadsheet_id: str
    question: str
    thread_id: str


class SheetsQueryResponse(BaseModel):
    answer: str
    thread_id: str
