"""
RAG retrieval — fetches relevant document chunks from the user's ChromaDB collection.
"""
from langchain_core.documents import Document

from app.ai.rag.chroma_client import get_user_vectorstore


async def retrieve_documents(
    query: str,
    user_id: str,
    k: int = 5,
    file_ids: list[str] | None = None,
) -> list[Document]:
    """Return the top-k most relevant document chunks for the query.

    If file_ids is provided, only chunks from those files are retrieved.
    """
    vectorstore = get_user_vectorstore(user_id)

    search_kwargs: dict = {"k": k}
    if file_ids:
        if len(file_ids) == 1:
            search_kwargs["filter"] = {"file_id": {"$eq": file_ids[0]}}
        else:
            search_kwargs["filter"] = {"file_id": {"$in": file_ids}}

    retriever = vectorstore.as_retriever(search_kwargs=search_kwargs)
    return await retriever.ainvoke(query)


def format_context(docs: list[Document]) -> str:
    """Format retrieved documents into a single context string."""
    return "\n\n---\n\n".join(doc.page_content for doc in docs)
