"""
LangGraph-based Tic Tac Toe agent.

Graph:  START → decide_move → END

The agent receives the current board and agent symbol, calls the LLM,
parses the response as an integer 0–8, and validates the move.
Falls back to minimax on any invalid or occupied output.
"""
import logging
import re
from pathlib import Path
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.ai.llm import llm, llm_explain
from app.core.config import settings
from app.services.board import GameBoard

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "tictactoe.txt"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8").strip()

_EXPLAIN_SYSTEM = (
    "You are a friendly Tic Tac Toe coach. Given a board state and the move just played "
    "by the AI agent, explain in 1–2 short sentences why that move was chosen. "
    "Be concise and educational. Do not use markdown formatting."
)


# ---------------------------------------------------------------------------
# Agent state
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    board: list[str | None]
    agent_symbol: str
    move: int | None
    reasoning: str | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_move(response: str, available: list[int]) -> int | None:
    matches = re.findall(r"\b([0-8])\b", response.strip())
    for match in matches:
        index = int(match)
        if index in available:
            return index
    return None


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def decide_move_node(state: AgentState) -> AgentState:
    board_obj = GameBoard(state["board"])
    available = board_obj.available_moves()
    agent_symbol = state["agent_symbol"]

    move: int | None = None
    reasoning: str | None = None

    # ---- LLM call --------------------------------------------------------
    user_msg = (
        f"Current board:\n{board_obj.to_ascii()}\n\n"
        f"You are playing as: {agent_symbol}\n"
        f"Available moves: {', '.join(str(m) for m in available)}\n\n"
        "Your move:"
    )
    try:
        response = llm.invoke(
            [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=user_msg)],
            config={"metadata": {"user": "agent"}},
        )
        raw = response.content if hasattr(response, "content") else str(response)
        move = _parse_move(str(raw), available)
        if move is None:
            logger.warning("LLM returned unparseable move: %r — falling back to minimax", raw)
    except Exception as exc:
        logger.warning("LLM call failed: %s — falling back to minimax", exc)

    # ---- Minimax fallback ------------------------------------------------
    if move is None:
        move = board_obj.best_minimax_move(agent_symbol)

    # ---- Optional reasoning call -----------------------------------------
    if settings.AGENT_EXPLAIN and move is not None:
        try:
            board_before = GameBoard(state["board"])
            explain_msg = (
                f"Board before the move:\n{board_before.to_ascii()}\n\n"
                f"The agent ({agent_symbol}) played cell {move}.\n\n"
                "Explain briefly why this was a good move."
            )
            expl_response = llm_explain.invoke(
                [SystemMessage(content=_EXPLAIN_SYSTEM), HumanMessage(content=explain_msg)],
                config={"metadata": {"user": "agent"}},
            )
            reasoning = str(
                expl_response.content if hasattr(expl_response, "content") else expl_response
            ).strip()
        except Exception as exc:
            logger.warning("Reasoning call failed: %s", exc)

    return {**state, "move": move, "reasoning": reasoning}


# ---------------------------------------------------------------------------
# Compile graph
# ---------------------------------------------------------------------------

_graph = StateGraph(AgentState)
_graph.add_node("decide_move", decide_move_node)
_graph.add_edge(START, "decide_move")
_graph.add_edge("decide_move", END)
agent = _graph.compile()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def decide_move(
    board: list[str | None], agent_symbol: str
) -> tuple[int, str | None]:
    """
    Run the agent and return (move_index, reasoning_text).
    Always returns a valid move (minimax fallback guaranteed).
    """
    result: AgentState = await agent.ainvoke(
        {"board": board, "agent_symbol": agent_symbol, "move": None, "reasoning": None}
    )
    move = result["move"]
    if move is None:
        # Ultimate fallback — should never reach here
        board_obj = GameBoard(board)
        move = board_obj.best_minimax_move(agent_symbol)
    return move, result.get("reasoning")
