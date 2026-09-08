from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.account import Account
from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.recurring import RecurringTransaction
from app.models.goal import Goal
from app.models.alert import Alert, AlertPreference
from app.models.bill import Bill
from app.models.memory import FinancialMemory

SYNC_TABLES = [
    "accounts",
    "categories",
    "category_rules",
    "transactions",
    "budgets",
    "recurring_transactions",
    "goals",
    "alerts",
    "alert_preferences",
    "bills",
    "financial_memories",
]

MODEL_MAP = {
    "accounts": Account,
    "categories": Category,
    "category_rules": CategoryRule,
    "transactions": Transaction,
    "budgets": Budget,
    "recurring_transactions": RecurringTransaction,
    "goals": Goal,
    "alerts": Alert,
    "alert_preferences": AlertPreference,
    "bills": Bill,
    "financial_memories": FinancialMemory,
}

EPOCH = datetime(1970, 1, 1)


EXCLUDED_COLUMNS = {"embedding_vector"}

SYNC_WRITABLE_FIELDS: dict[str, set[str]] = {
    "accounts": {"name", "type", "icon", "color", "currency", "is_archived"},
    "categories": {"name", "icon", "color", "type", "parent_id", "sort_order"},
    "category_rules": {"category_id", "contains_keyword", "merchant_name", "min_amount", "max_amount", "priority", "is_active"},
    "transactions": {"account_id", "category_id", "amount", "type", "description", "merchant", "date", "is_recurring", "recurring_id", "bill_id", "notes", "tags", "is_split", "parent_split_id"},
    "budgets": {"category_id", "amount", "period", "start_date", "end_date", "is_active", "rollover"},
    "recurring_transactions": {"account_id", "category_id", "amount", "type", "description", "merchant", "frequency", "interval_value", "next_date", "end_date", "is_active"},
    "goals": {"name", "target_amount", "current_amount", "deadline", "category_id", "icon", "color", "status", "monthly_contribution", "notes"},
    "alerts": {"type", "title", "message", "severity", "category_id", "related_amount", "is_read", "is_dismissed"},
    "alert_preferences": {"alert_type", "enabled", "threshold"},
    "bills": {"name", "amount", "due_date", "is_paid", "paid_date", "category_id", "recurring_id", "notes"},
    "financial_memories": {"key", "value", "context", "embedding", "memory_type", "importance"},
}

PROTECTED_FIELDS = {"user_id", "created_at", "updated_at", "deleted_at", "embedding_vector", "balance"}

def _model_to_dict(obj: Any) -> dict:
    d = {}
    for col in obj.__table__.columns:
        if col.name in EXCLUDED_COLUMNS:
            continue
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


def _parse_timestamp(ts: Optional[str]) -> datetime:
    if not ts:
        return EPOCH
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        # DB stores naive timestamps; strip tzinfo so Python comparisons stay
        # naive-vs-naive (avoiding "can't compare offset-naive and offset-aware").
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except (ValueError, TypeError):
        return EPOCH


class SyncService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def pull_changes(
        self, user_id: str, last_pulled_at: Optional[str] = None
    ) -> dict:
        last_pulled_dt = _parse_timestamp(last_pulled_at)
        is_initial = last_pulled_dt == EPOCH
        server_timestamp = datetime.now().isoformat()
        changes: dict[str, dict[str, list]] = {}

        for table_name in SYNC_TABLES:
            model = MODEL_MAP[table_name]
            created: list[dict] = []
            updated: list[dict] = []
            deleted: list[dict] = []

            if is_initial:
                query = select(model).where(model.user_id == user_id, model.deleted_at.is_(None))
            else:
                query = select(model).where(
                    model.user_id == user_id,
                    model.updated_at >= last_pulled_dt,
                )
                if model.__tablename__ in ("alerts", "alert_preferences", "financial_memories"):
                    pass

            records = await self.db.execute(query)
            for row in records.scalars().all():
                record_dict = _model_to_dict(row)
                if row.deleted_at and row.deleted_at >= last_pulled_dt:
                    deleted.append(record_dict)
                    continue
                if row.deleted_at:
                    continue
                if (
                    row.created_at
                    and row.created_at >= last_pulled_dt
                ):
                    created.append(record_dict)
                else:
                    updated.append(record_dict)

            changes[table_name] = {
                "created": created,
                "updated": updated,
                "deleted": deleted,
            }

        return {"changes": changes, "timestamp": server_timestamp}

    async def push_changes(self, user_id: str, changes: dict[str, Any]) -> dict:
        results: dict[str, dict[str, int]] = {}

        for table_name, operations in changes.items():
            model = MODEL_MAP.get(table_name)
            if not model:
                results[table_name] = {"created": 0, "updated": 0, "deleted": 0}
                continue

            created_count = 0
            updated_count = 0
            deleted_count = 0

            writable = SYNC_WRITABLE_FIELDS.get(table_name, set())
            for record_data in operations.get("created", []):
                rid = record_data.get("id")
                if not rid:
                    continue
                existing = await self.db.execute(
                    select(model).where(model.id == rid)
                )
                if existing.scalar_one_or_none():
                    continue
                filtered = {k: v for k, v in record_data.items() if k in writable or k == "id"}
                filtered["user_id"] = user_id
                filtered["deleted_at"] = None
                obj = model(**filtered)
                self.db.add(obj)
                created_count += 1

            for record_data in operations.get("updated", []):
                rid = record_data.get("id")
                if not rid:
                    continue
                existing = await self.db.execute(
                    select(model).where(
                        model.id == rid,
                        model.user_id == user_id,
                    )
                )
                obj = existing.scalar_one_or_none()
                if not obj:
                    filtered = {k: v for k, v in record_data.items() if k in writable or k == "id"}
                    filtered["user_id"] = user_id
                    filtered["deleted_at"] = None
                    obj = model(**filtered)
                    self.db.add(obj)
                    created_count += 1
                else:
                    client_updated = record_data.get("updated_at")
                    client_dt = _parse_timestamp(client_updated)
                    server_updated = obj.updated_at
                    if server_updated and client_dt > server_updated:
                        for field, value in record_data.items():
                            if field in writable:
                                setattr(obj, field, value)
                        obj.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                        updated_count += 1

            for record_data in operations.get("deleted", []):
                existing = await self.db.execute(
                    select(model).where(
                        model.id == record_data["id"],
                        model.user_id == user_id,
                    )
                )
                obj = existing.scalar_one_or_none()
                if obj and not obj.deleted_at:
                    obj.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    deleted_count += 1

            await self.db.flush()

            results[table_name] = {
                "created": created_count,
                "updated": updated_count,
                "deleted": deleted_count,
            }

        return results
