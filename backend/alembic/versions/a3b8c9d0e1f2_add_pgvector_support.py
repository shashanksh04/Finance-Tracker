"""Add pgvector support for financial memories

Revision ID: a3b8c9d0e1f2
Revises: f279aac93465
Create Date: 2026-07-07 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a3b8c9d0e1f2'
down_revision: Union[str, None] = 'f279aac93465'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _pgvector_available() -> bool:
    bind = op.get_bind()
    row = bind.execute(
        sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")
    ).scalar_one_or_none()
    return bool(row)


def upgrade() -> None:
    if not _pgvector_available():
        print(
            "pgvector extension not available on this server; "
            "skipping embedding_vector column"
        )
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column('financial_memories',
        sa.Column('embedding_vector', sa.Text(), nullable=True)
    )
    from app.core.config import settings as _settings
    dim = int(getattr(_settings, "EMBEDDING_DIMENSION", 1024))
    op.execute(
        f"ALTER TABLE financial_memories "
        f"ALTER COLUMN embedding_vector TYPE vector({dim}) "
        f"USING embedding_vector::vector({dim})"
    )
    op.execute(
        "CREATE INDEX ix_financial_memories_embedding_vector "
        "ON financial_memories "
        "USING ivfflat (embedding_vector vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    if not _pgvector_available():
        return
    op.execute("DROP INDEX IF EXISTS ix_financial_memories_embedding_vector")
    op.drop_column('financial_memories', 'embedding_vector')
