from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class StartGameRequest(BaseModel):
    player_symbol: Literal["X", "O"] = "X"
    agent_mode: Literal["llm", "minimax", "random"] = "llm"


class MoveRequest(BaseModel):
    game_id: UUID
    cell_index: int = Field(..., ge=0, le=8)


class GameState(BaseModel):
    game_id: UUID
    board: list[str | None]
    status: str
    winner: str | None
    player_symbol: str
    agent_symbol: str
    agent_mode: str
    winning_line: list[int] | None

    model_config = {"from_attributes": True}


class MoveResponse(BaseModel):
    game_state: GameState
    agent_move: int | None
    agent_reasoning: str | None


class GameSummary(BaseModel):
    game_id: UUID
    player_symbol: str
    agent_symbol: str
    agent_mode: str
    status: str
    winner: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
