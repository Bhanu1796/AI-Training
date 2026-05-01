"""
RAG LCEL chain — answers questions grounded in retrieved document context.
"""
from pathlib import Path

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.ai.llm import llm

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "rag.txt"
_system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")

rag_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", _system_prompt),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{human_input}"),
    ]
)

rag_chain = rag_prompt | llm | StrOutputParser()
