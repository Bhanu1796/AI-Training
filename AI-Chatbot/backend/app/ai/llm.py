"""
LiteLLM client singletons — import all AI clients from this module.
Never instantiate LLM clients elsewhere in the codebase.
"""
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from openai import OpenAI

from app.core.config import settings

# LangChain LLM — used in all LCEL chains
llm = ChatOpenAI(
    model=settings.LLM_MODEL,
    base_url=settings.LITELLM_PROXY_URL,
    api_key=settings.LITELLM_API_KEY,
    timeout=30,
    max_retries=2,
    streaming=True,
)

# OpenAI SDK client — used for direct calls (image generation, embeddings via SDK)
openai_client = OpenAI(
    api_key=settings.LITELLM_API_KEY,
    base_url=settings.LITELLM_PROXY_URL,
)

# LangChain Embeddings — used in ChromaDB ingestion and retrieval
embeddings = OpenAIEmbeddings(
    model=settings.LITELLM_EMBEDDING_MODEL,
    base_url=settings.LITELLM_PROXY_URL,
    api_key=settings.LITELLM_API_KEY,
)
