"""add the five model-declared indexes that were never migrated

Revision ID: f1a2b3c4d5e6
Revises: e6f7a8b9c0d1
"""
from typing import Union

from alembic import op

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None

# name -> (table, columns). Every one of these is declared in a model
# __table_args__ but was absent from every migration, so none of them
# exist in the deployed database.
INDEXES = [
    ("ix_bills_user_due_deleted", "bills", ["user_id", "due_date", "deleted_at"]),
    ("ix_recurring_next_active_deleted", "recurring_transactions", ["next_date", "is_active", "deleted_at"]),
    ("ix_transactions_user_deleted_date", "transactions", ["user_id", "deleted_at", "date"]),
    ("ix_transactions_user_type", "transactions", ["user_id", "type"]),
    # Despite the name this is a plain b-tree index. The model declares it
    # without postgresql_using="gin" / gin_trgm_ops, so it needs no pg_trgm
    # extension. No actual trigram search is configured anywhere in the app.
    ("ix_transactions_merchant_trgm", "transactions", ["merchant"]),
]


def upgrade() -> None:
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns, unique=False, if_not_exists=True)


def downgrade() -> None:
    for name, table, _columns in reversed(INDEXES):
        op.drop_index(name, table_name=table, if_exists=True)
