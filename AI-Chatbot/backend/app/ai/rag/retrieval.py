"""
RAG retrieval — fetches relevant document chunks from the user's ChromaDB collection.
"""
from langchain_core.documents import Document

from app.ai.rag.chroma_client import get_user_vectorstore


async def retrieve_documents(
    query: str,
    user_id: str,
    k: int = 5,
) -> list[Document]:
    """Return the top-k most relevant document chunks for the query."""
    vectorstore = get_user_vectorstore(user_id)
    retriever = vectorstore.as_retriever(search_kwargs={"k": k})
    return await retriever.ainvoke(query)


def format_context(docs: list[Document]) -> str:
    """Format retrieved documents into a single context string."""
    return "\n\n---\n\n".join(doc.page_content for doc in docs)
