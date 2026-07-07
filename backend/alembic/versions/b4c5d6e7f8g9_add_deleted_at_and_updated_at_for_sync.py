"""Add deleted_at and missing updated_at columns for offline sync support

Migration ID: b4c5d6e7f8g9
Description: Adds deleted_at (soft-delete) to all tables and updated_at to
tables that were missing it (categories, category_rules, alerts, alert_preferences).
Also adds indexes on updated_at for sync query performance.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b4c5d6e7f8g9"
down_revision: Union[str, None] = "a3b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Add deleted_at to all tables ===
    for table in (
        "users", "accounts", "transactions", "budgets",
        "recurring_transactions", "goals", "bills", "financial_memories",
    ):
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(), nullable=True))

    # === Add deleted_at + updated_at to tables missing updated_at ===
    op.add_column("categories", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("categories", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True))

    op.add_column("category_rules", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("category_rules", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True))

    op.add_column("alerts", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("alerts", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True))

    op.add_column("alert_preferences", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("alert_preferences", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True))

    # === Create indexes on updated_at for sync performance ===
    op.create_index("ix_users_updated_at", "users", ["updated_at"])
    op.create_index("ix_accounts_updated_at", "accounts", ["updated_at"])
    op.create_index("ix_transactions_updated_at", "transactions", ["updated_at"])
    op.create_index("ix_categories_updated_at", "categories", ["updated_at"])
    op.create_index("ix_category_rules_updated_at", "category_rules", ["updated_at"])
    op.create_index("ix_budgets_updated_at", "budgets", ["updated_at"])
    op.create_index("ix_recurring_transactions_updated_at", "recurring_transactions", ["updated_at"])
    op.create_index("ix_goals_updated_at", "goals", ["updated_at"])
    op.create_index("ix_alerts_updated_at", "alerts", ["updated_at"])
    op.create_index("ix_alert_preferences_updated_at", "alert_preferences", ["updated_at"])
    op.create_index("ix_bills_updated_at", "bills", ["updated_at"])
    op.create_index("ix_financial_memories_updated_at", "financial_memories", ["updated_at"])


def downgrade() -> None:
    # Drop indexes
    for idx in (
        "ix_users_updated_at", "ix_accounts_updated_at", "ix_transactions_updated_at",
        "ix_categories_updated_at", "ix_category_rules_updated_at", "ix_budgets_updated_at",
        "ix_recurring_transactions_updated_at", "ix_goals_updated_at", "ix_alerts_updated_at",
        "ix_alert_preferences_updated_at", "ix_bills_updated_at", "ix_financial_memories_updated_at",
    ):
        op.drop_index(idx)

    # Drop added columns
    for table in (
        "users", "accounts", "transactions", "budgets",
        "recurring_transactions", "goals", "bills", "financial_memories",
    ):
        op.drop_column(table, "deleted_at")

    op.drop_column("categories", "deleted_at")
    op.drop_column("categories", "updated_at")
    op.drop_column("category_rules", "deleted_at")
    op.drop_column("category_rules", "updated_at")
    op.drop_column("alerts", "deleted_at")
    op.drop_column("alerts", "updated_at")
    op.drop_column("alert_preferences", "deleted_at")
    op.drop_column("alert_preferences", "updated_at")
