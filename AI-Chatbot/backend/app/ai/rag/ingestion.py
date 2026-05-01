"""
Document ingestion — chunks and embeds uploaded documents into ChromaDB.
"""
import uuid
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader, UnstructuredExcelLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.ai.rag.chroma_client import get_user_vectorstore

_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)

_LOADER_MAP: dict[str, type] = {
    "application/pdf": PyPDFLoader,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": UnstructuredExcelLoader,
    "application/vnd.ms-excel": UnstructuredExcelLoader,
}


async def ingest_document(
    file_path: str,
    mime_type: str,
    user_id: str,
    file_id: str,
) -> int:
    """Load, chunk, and embed a document. Returns the number of chunks stored."""
    loader_cls = _LOADER_MAP.get(mime_type)
    if loader_cls is None:
        raise ValueError(f"Unsupported MIME type for RAG ingestion: {mime_type}")

    loader = loader_cls(file_path)
    docs = loader.load()
    chunks = _splitter.split_documents(docs)

    for chunk in chunks:
        chunk.metadata["file_id"] = file_id
        chunk.metadata["user_id"] = user_id

    vectorstore = get_user_vectorstore(user_id)
    ids = [str(uuid.uuid4()) for _ in chunks]
    vectorstore.add_documents(chunks, ids=ids)

    return len(chunks)
