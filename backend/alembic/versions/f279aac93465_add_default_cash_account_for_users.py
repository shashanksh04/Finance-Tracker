"""Add default Cash account for existing users

Revision ID: f279aac93465
Revises: 1f42e1b7c742
Create Date: 2026-07-01 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import uuid


revision: str = 'f279aac93465'
down_revision: Union[str, None] = '1f42e1b7c742'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("""
            SELECT u.id FROM users u
            WHERE NOT EXISTS (
                SELECT 1 FROM accounts a
                WHERE a.user_id = u.id AND LOWER(a.name) = 'cash'
            )
        """)
    )
    for row in result:
        user_id = row[0]
        account_id = str(uuid.uuid4())
        conn.execute(
            sa.text("""
                INSERT INTO accounts (id, user_id, name, type, balance, currency, is_archived)
                VALUES (:id, :user_id, 'Cash', 'cash', 0, 'INR', false)
            """),
            {"id": account_id, "user_id": user_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM accounts WHERE name = 'Cash' AND balance = 0")
    )
