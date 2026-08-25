"""add categorization learning fields and auto_rule_id

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column('category_rules', sa.Column('confidence', sa.Numeric(3, 2), nullable=False, server_default=sa.text('0.5')))
    op.add_column('category_rules', sa.Column('hit_count', sa.Integer(), nullable=False, server_default=sa.text('0')))
    op.add_column('category_rules', sa.Column('miss_count', sa.Integer(), nullable=False, server_default=sa.text('0')))
    op.add_column('category_rules', sa.Column('last_matched_at', sa.DateTime(), nullable=True))

    op.add_column('transactions', sa.Column('auto_rule_id', sa.String(36), nullable=True))
    op.create_foreign_key('fk_transactions_auto_rule_id', 'transactions', 'category_rules', ['auto_rule_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_transactions_auto_rule_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'auto_rule_id')

    op.drop_column('category_rules', 'last_matched_at')
    op.drop_column('category_rules', 'miss_count')
    op.drop_column('category_rules', 'hit_count')
    op.drop_column('category_rules', 'confidence')
