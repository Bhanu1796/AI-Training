"""
Chat LCEL chain — streaming conversational chain backed by DB memory.
"""
from pathlib import Path

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.ai.llm import llm

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "chat.txt"
_system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")

chat_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", _system_prompt),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{human_input}"),
    ]
)

chat_chain = chat_prompt | llm | StrOutputParser()
