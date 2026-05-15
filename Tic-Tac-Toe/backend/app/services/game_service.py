"""
Game service — all business logic lives here.
The API router calls these functions; no game logic exists in the router.
"""
import random
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.game import Game
from app.schemas.game import GameState, GameSummary, MoveResponse, StartGameRequest
from app.services.board import GameBoard


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_game_state(game: Game) -> GameState:
    return GameState(
        game_id=game.id,
        board=game.board,
        status=game.status,
        winner=game.winner,
        player_symbol=game.player_symbol,
        agent_symbol=game.agent_symbol,
        agent_mode=game.agent_mode,
        winning_line=game.winning_line,
    )


async def _get_or_404(db: AsyncSession, game_id: UUID) -> Game:
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if game is None:
        raise ValueError(f"Game {game_id} not found")
    return game


def _pick_agent_move_sync(board_obj: GameBoard, agent_symbol: str, mode: str) -> int:
    """Synchronous fallback — used only for minimax/random modes, never for llm."""
    available = board_obj.available_moves()
    if mode == "random":
        return random.choice(available)
    return board_obj.best_minimax_move(agent_symbol)


async def _pick_agent_move(board_obj: GameBoard, agent_symbol: str, mode: str) -> tuple[int, str | None]:
    """Async agent move selection — routes to LLM agent or deterministic fallback."""
    if mode == "llm":
        from app.ai.agent.tictactoe_agent import decide_move as llm_decide
        return await llm_decide(board_obj.board[:], agent_symbol)
    return _pick_agent_move_sync(board_obj, agent_symbol, mode), None


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

async def start_game(req: StartGameRequest, db: AsyncSession) -> GameState:
    agent_symbol = "O" if req.player_symbol == "X" else "X"

    game = Game(
        board=[None] * 9,
        player_symbol=req.player_symbol,
        agent_symbol=agent_symbol,
        agent_mode=req.agent_mode,
        status="player_turn",
        winner=None,
        winning_line=None,
        move_history=[],
    )

    # If player chose O, agent (X) goes first
    if req.player_symbol == "O":
        board_obj = GameBoard(game.board)
        agent_move, _ = await _pick_agent_move(board_obj, agent_symbol, req.agent_mode)
        board_obj.apply_move(agent_move, agent_symbol)
        game.board = board_obj.board[:]
        game.move_history = [
            {"symbol": agent_symbol, "index": agent_move, "ts": datetime.now(timezone.utc).isoformat()}
        ]

    db.add(game)
    await db.flush()
    return _build_game_state(game)


async def apply_move(
    game_id: UUID, cell_index: int, db: AsyncSession
) -> MoveResponse:
    game = await _get_or_404(db, game_id)

    if game.status == "game_over":
        raise ValueError("Game is already over")
    if game.status != "player_turn":
        raise ValueError("It is not the player's turn")

    board_obj = GameBoard(game.board)

    # --- Player move ---
    board_obj.apply_move(cell_index, game.player_symbol)
    history: list[dict] = list(game.move_history or [])
    history.append({
        "symbol": game.player_symbol,
        "index": cell_index,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    winner, winning_line = board_obj.check_winner_with_line()
    agent_move_index: int | None = None
    reasoning: str | None = None

    if winner or board_obj.is_draw():
        game.board = board_obj.board[:]
        game.move_history = history
        game.status = "game_over"
        game.winning_line = winning_line
        game.winner = "player" if winner == game.player_symbol else "draw"
        game.updated_at = datetime.now(timezone.utc)
        return MoveResponse(
            game_state=_build_game_state(game),
            agent_move=None,
            agent_reasoning=None,
        )

    # --- Agent move ---
    game.status = "agent_thinking"

    agent_move_index, reasoning = await _pick_agent_move(board_obj, game.agent_symbol, game.agent_mode)

    board_obj.apply_move(agent_move_index, game.agent_symbol)
    history.append({
        "symbol": game.agent_symbol,
        "index": agent_move_index,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    winner, winning_line = board_obj.check_winner_with_line()

    game.board = board_obj.board[:]
    game.move_history = history
    game.updated_at = datetime.now(timezone.utc)

    if winner or board_obj.is_draw():
        game.status = "game_over"
        game.winning_line = winning_line
        game.winner = "agent" if winner == game.agent_symbol else "draw"
    else:
        game.status = "player_turn"

    return MoveResponse(
        game_state=_build_game_state(game),
        agent_move=agent_move_index,
        agent_reasoning=reasoning,
    )


async def get_game(game_id: UUID, db: AsyncSession) -> GameState:
    game = await _get_or_404(db, game_id)
    return _build_game_state(game)


async def reset_game(game_id: UUID, db: AsyncSession) -> GameState:
    game = await _get_or_404(db, game_id)

    game.board = [None] * 9
    game.status = "player_turn"
    game.winner = None
    game.winning_line = None
    game.move_history = []
    game.updated_at = datetime.now(timezone.utc)

    # If player is O, agent (X) goes first again
    if game.player_symbol == "O":
        board_obj = GameBoard()
        agent_move, _ = await _pick_agent_move(board_obj, game.agent_symbol, game.agent_mode)
        board_obj.apply_move(agent_move, game.agent_symbol)
        game.board = board_obj.board[:]
        game.move_history = [
            {"symbol": game.agent_symbol, "index": agent_move, "ts": datetime.now(timezone.utc).isoformat()}
        ]

    return _build_game_state(game)


async def list_games(db: AsyncSession) -> list[GameSummary]:
    result = await db.execute(
        select(Game).order_by(Game.created_at.desc()).limit(50)
    )
    games = result.scalars().all()
    return [GameSummary.model_validate(g) for g in games]
