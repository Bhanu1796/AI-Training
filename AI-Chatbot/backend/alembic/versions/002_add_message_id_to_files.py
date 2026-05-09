"""Add message_id to uploaded_files

Revision ID: 002
Revises: 001
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "uploaded_files",
        sa.Column("message_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_uploaded_files_message_id",
        "uploaded_files",
        "messages",
        ["message_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_uploaded_files_message_id", "uploaded_files", ["message_id"])


def downgrade() -> None:
    op.drop_index("ix_uploaded_files_message_id", table_name="uploaded_files")
    op.drop_constraint("fk_uploaded_files_message_id", "uploaded_files", type_="foreignkey")
    op.drop_column("uploaded_files", "message_id")
