from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.game import GameState, GameSummary, MoveRequest, MoveResponse, StartGameRequest
from app.services import game_service

router = APIRouter(prefix="/game", tags=["game"])


@router.post("/start", response_model=GameState, status_code=status.HTTP_201_CREATED)
async def start_game(req: StartGameRequest, db: AsyncSession = Depends(get_db)):
    return await game_service.start_game(req, db)


@router.post("/move", response_model=MoveResponse)
async def make_move(req: MoveRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await game_service.apply_move(req.game_id, req.cell_index, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/history", response_model=list[GameSummary])
async def game_history(db: AsyncSession = Depends(get_db)):
    return await game_service.list_games(db)


@router.get("/{game_id}", response_model=GameState)
async def get_game(game_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        return await game_service.get_game(game_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{game_id}/reset", response_model=GameState)
async def reset_game(game_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        return await game_service.reset_game(game_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
