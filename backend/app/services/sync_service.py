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

EPOCH = datetime.fromtimestamp(0, tz=timezone.utc)


EXCLUDED_COLUMNS = {"embedding_vector"}

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
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
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
        server_timestamp = datetime.now(timezone.utc).isoformat()
        changes: dict[str, dict[str, list]] = {}

        for table_name in SYNC_TABLES:
            model = MODEL_MAP[table_name]
            created: list[dict] = []
            updated: list[dict] = []
            deleted: list[dict] = []

            if is_initial:
                query = select(model).where(model.user_id == user_id)
            else:
                query = select(model).where(
                    model.user_id == user_id,
                    or_(
                        model.updated_at >= last_pulled_dt,
                        model.updated_at.is_(None),
                    ),
                )

            records = await self.db.execute(query)
            for row in records.scalars().all():
                record_dict = _model_to_dict(row)
                if row.deleted_at:
                    deleted.append(record_dict)
                elif (
                    row.created_at
                    and row.created_at >= last_pulled_dt
                    and row.created_at == row.updated_at
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

            for record_data in operations.get("created", []):
                record_data["user_id"] = user_id
                if "deleted_at" not in record_data:
                    record_data["deleted_at"] = None
                existing = await self.db.execute(
                    select(model).where(model.id == record_data["id"])
                )
                if existing.scalar_one_or_none():
                    continue
                obj = model(**record_data)
                self.db.add(obj)
                created_count += 1

            for record_data in operations.get("updated", []):
                existing = await self.db.execute(
                    select(model).where(
                        model.id == record_data["id"],
                        model.user_id == user_id,
                    )
                )
                obj = existing.scalar_one_or_none()
                if not obj:
                    record_data["user_id"] = user_id
                    if "deleted_at" not in record_data:
                        record_data["deleted_at"] = None
                    obj = model(**record_data)
                    self.db.add(obj)
                    created_count += 1
                else:
                    client_updated = record_data.get("updated_at")
                    client_dt = _parse_timestamp(client_updated)
                    server_updated = obj.updated_at
                    if server_updated and client_dt > server_updated.replace(tzinfo=timezone.utc):
                        for field, value in record_data.items():
                            if field not in ("id", "user_id", "created_at", "user"):
                                setattr(obj, field, value)
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
                    obj.deleted_at = datetime.now(timezone.utc)
                    deleted_count += 1

            await self.db.flush()

            results[table_name] = {
                "created": created_count,
                "updated": updated_count,
                "deleted": deleted_count,
            }

        return results
