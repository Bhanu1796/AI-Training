import uuid
from datetime import datetime

from pydantic import BaseModel


class FileRead(BaseModel):
    id: uuid.UUID
    original_filename: str
    mime_type: str
    file_type: str
    file_size: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FileUploadResponse(BaseModel):
    file: FileRead
    message: str = "File uploaded successfully"
