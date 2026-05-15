"""001_create_games

Revision ID: 001
Revises:
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "games",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("board", sa.JSON(), nullable=False),
        sa.Column("player_symbol", sa.String(1), nullable=False),
        sa.Column("agent_symbol", sa.String(1), nullable=False),
        sa.Column("agent_mode", sa.String(10), nullable=False, server_default="llm"),
        sa.Column("status", sa.String(20), nullable=False, server_default="player_turn"),
        sa.Column("winner", sa.String(10), nullable=True),
        sa.Column("winning_line", sa.JSON(), nullable=True),
        sa.Column("move_history", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("games")
