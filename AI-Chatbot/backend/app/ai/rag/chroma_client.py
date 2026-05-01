"""
ChromaDB client — one collection per user (AD-04).
"""
import chromadb
from langchain_chroma import Chroma

from app.ai.llm import embeddings
from app.core.config import settings

_chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)


def get_user_vectorstore(user_id: str) -> Chroma:
    """Return a Chroma vectorstore scoped to the given user."""
    collection_name = f"user_{user_id}"
    return Chroma(
        client=_chroma_client,
        collection_name=collection_name,
        embedding_function=embeddings,
    )
