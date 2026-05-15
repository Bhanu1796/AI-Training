"""
LiteLLM client singleton — all AI calls route through this module.
Never instantiate LLM clients elsewhere in the codebase.
"""
from langchain_openai import ChatOpenAI

from app.core.config import settings

# Non-streaming LLM for agent move decisions (we need the full response before acting)
llm = ChatOpenAI(
    model=settings.LLM_MODEL,
    base_url=settings.LITELLM_PROXY_URL,
    api_key=settings.LITELLM_API_KEY,
    temperature=0.2,
    timeout=30,
    max_retries=2,
    streaming=False,
)

# Higher-temperature LLM for natural reasoning/explanation text
llm_explain = ChatOpenAI(
    model=settings.LLM_MODEL,
    base_url=settings.LITELLM_PROXY_URL,
    api_key=settings.LITELLM_API_KEY,
    temperature=0.7,
    timeout=30,
    max_retries=2,
    streaming=False,
)
