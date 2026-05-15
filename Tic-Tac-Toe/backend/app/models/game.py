import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    board: Mapped[list] = mapped_column(JSON, nullable=False)
    player_symbol: Mapped[str] = mapped_column(String(1), nullable=False)
    agent_symbol: Mapped[str] = mapped_column(String(1), nullable=False)
    agent_mode: Mapped[str] = mapped_column(String(10), nullable=False, default="llm")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="player_turn")
    winner: Mapped[str | None] = mapped_column(String(10), nullable=True)
    winning_line: Mapped[list | None] = mapped_column(JSON, nullable=True)
    move_history: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
