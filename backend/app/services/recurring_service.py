from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.models.recurring import RecurringTransaction
from app.schemas.recurring import RecurringCreate, RecurringUpdate
from fastapi import HTTPException, status
from datetime import date, timedelta
import calendar


class RecurringService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: RecurringCreate) -> dict:
        kwargs = data.model_dump()
        kwargs.pop('type', None)
        recurring = RecurringTransaction(user_id=user_id, type=data.type, **kwargs)
        self.db.add(recurring)
        await self.db.flush()
        await self.db.refresh(recurring, ['account', 'category'])
        return await self._enrich(recurring)

    async def get_all(self, user_id: str, active_only: bool = False) -> list[dict]:
        query = select(RecurringTransaction).options(
            joinedload(RecurringTransaction.account),
            joinedload(RecurringTransaction.category),
        ).where(RecurringTransaction.user_id == user_id)
        if active_only:
            query = query.where(RecurringTransaction.is_active == True)
        result = await self.db.execute(query.order_by(RecurringTransaction.next_date))
        items = list(result.unique().scalars().all())
        return [await self._enrich(i) for i in items]

    async def get_by_id(self, user_id: str, recurring_id: str) -> dict:
        result = await self.db.execute(
            select(RecurringTransaction).where(RecurringTransaction.id == recurring_id, RecurringTransaction.user_id == user_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Recurring transaction not found")
        return await self._enrich(item)

    async def update(self, user_id: str, recurring_id: str, data: RecurringUpdate) -> dict:
        result = await self.db.execute(
            select(RecurringTransaction).options(
                joinedload(RecurringTransaction.account),
                joinedload(RecurringTransaction.category),
            ).where(RecurringTransaction.id == recurring_id, RecurringTransaction.user_id == user_id)
        )
        item = result.unique().scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Recurring transaction not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        await self.db.flush()
        await self.db.refresh(item)
        return await self._enrich(item)

    async def delete(self, user_id: str, recurring_id: str) -> bool:
        result = await self.db.execute(
            select(RecurringTransaction).where(RecurringTransaction.id == recurring_id, RecurringTransaction.user_id == user_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Recurring transaction not found")
        await self.db.delete(item)
        await self.db.flush()
        return True

    async def process_due(self) -> list[dict]:
        today = date.today()
        result = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.is_active == True,
                RecurringTransaction.next_date <= today,
            )
        )
        items = list(result.scalars().all())
        created = []
        for item in items:
            from app.models.transaction import Transaction
            txn = Transaction(
                user_id=item.user_id,
                account_id=item.account_id,
                category_id=item.category_id,
                amount=item.amount,
                type=item.type,
                description=f"[Recurring] {item.description}",
                merchant=item.merchant,
                date=today,
                is_recurring=True,
                recurring_id=item.id,
            )
            self.db.add(txn)
            item.next_date = self._calculate_next_date(item.next_date, item.frequency, item.interval_value)
            if item.end_date and item.next_date > item.end_date:
                item.is_active = False
            created.append(txn)
        await self.db.flush()
        return [self._enrich(i) for i in items]

    def _calculate_next_date(self, from_date: date, frequency: str, interval: int) -> date:
        if frequency == "daily":
            return from_date + timedelta(days=interval)
        elif frequency == "weekly":
            return from_date + timedelta(weeks=interval)
        elif frequency == "biweekly":
            return from_date + timedelta(weeks=2 * interval)
        elif frequency == "monthly":
            month = from_date.month - 1 + interval
            year = from_date.year + month // 12
            month = month % 12 + 1
            last_day = calendar.monthrange(year, month)[1]
            day = min(from_date.day, last_day)
            return date(year, month, day)
        elif frequency == "quarterly":
            return self._calculate_next_date(from_date, "monthly", 3 * interval)
        elif frequency == "yearly":
            return self._calculate_next_date(from_date, "monthly", 12 * interval)
        return from_date

    async def _enrich(self, item: RecurringTransaction) -> dict:
        account_name = ""
        category_name = None
        if item.account:
            account_name = item.account.name
        if item.category:
            category_name = item.category.name
        return {
            "id": item.id,
            "account_id": item.account_id,
            "account_name": account_name,
            "category_id": item.category_id,
            "category_name": category_name,
            "amount": float(item.amount),
            "type": item.type,
            "description": item.description,
            "merchant": item.merchant,
            "frequency": item.frequency,
            "interval_value": item.interval_value,
            "next_date": item.next_date.isoformat() if item.next_date else None,
            "end_date": item.end_date.isoformat() if item.end_date else None,
            "is_active": item.is_active,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
