import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ThreadCreate(BaseModel):
    title: str = "New Chat"


class ThreadRead(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ThreadUpdate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    content: str
    thread_id: uuid.UUID
    file_ids: Optional[list[uuid.UUID]] = None


class MessageRead(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    role: str
    content: str
    token_count: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
