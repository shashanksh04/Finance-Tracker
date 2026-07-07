"""Set server default for onboarding_completed

Revision ID: 1f42e1b7c742
Revises: 1375a454a7f0
Create Date: 2026-06-11 12:08:24.142886
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '1f42e1b7c742'
down_revision: Union[str, None] = '1375a454a7f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'onboarding_completed', server_default=sa.text('false'))
    op.execute("UPDATE users SET onboarding_completed = false WHERE onboarding_completed IS NULL")


def downgrade() -> None:
    op.alter_column('users', 'onboarding_completed', server_default=None)
