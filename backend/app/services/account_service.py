from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from app.models.account import Account
from app.models.transaction import Transaction
from app.schemas.account import AccountCreate, AccountUpdate
from fastapi import HTTPException, status


class AccountService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: AccountCreate) -> Account:
        account = Account(user_id=user_id, **data.model_dump())
        self.db.add(account)
        await self.db.flush()
        return account

    async def get_all(self, user_id: str, include_archived: bool = False, page: int = 0, page_size: int = 0) -> list[Account] | dict:
        query = select(Account).where(Account.user_id == user_id, Account.deleted_at.is_(None))
        if not include_archived:
            query = query.where(Account.is_archived == False)
        query = query.order_by(Account.created_at)
        if page > 0 and page_size > 0:
            count_query = select(func.count()).select_from(query.subquery())
            total = (await self.db.execute(count_query)).scalar() or 0
            query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        accounts = list(result.scalars().all())
        enriched = await self._enrich_batch(accounts)
        if page > 0 and page_size > 0:
            return {
                "items": enriched,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }
        return enriched

    async def get_by_id(self, user_id: str, account_id: str) -> Account:
        result = await self.db.execute(
            select(Account).where(Account.id == account_id, Account.user_id == user_id, Account.deleted_at.is_(None))
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        enriched = await self._enrich_batch([account])
        return enriched[0]

    async def update(self, user_id: str, account_id: str, data: AccountUpdate) -> Account:
        account = await self.db.execute(
            select(Account).where(Account.id == account_id, Account.user_id == user_id, Account.deleted_at.is_(None))
        )
        account = account.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(account, field, value)
        await self.db.flush()
        await self.db.refresh(account)
        enriched = await self._enrich_batch([account])
        return enriched[0]

    async def delete(self, user_id: str, account_id: str) -> bool:
        account = await self.db.execute(
            select(Account).where(Account.id == account_id, Account.user_id == user_id, Account.deleted_at.is_(None))
        )
        account = account.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        from app.models.transaction import Transaction
        from app.models.recurring import RecurringTransaction
        now = datetime.now(timezone.utc)
        await self.db.execute(
            Transaction.__table__.update().where(Transaction.account_id == account_id).values(deleted_at=now)
        )
        await self.db.execute(
            RecurringTransaction.__table__.update().where(RecurringTransaction.account_id == account_id).values(deleted_at=now)
        )
        account.deleted_at = now
        await self.db.flush()
        from app.ws.events import notify_dashboard_updated, notify_alerts_updated
        await notify_dashboard_updated(user_id)
        await notify_alerts_updated(user_id)
        return True

    async def get_summary(self, user_id: str, account_id: str) -> dict:
        result = await self.db.execute(
            select(Account).where(Account.id == account_id, Account.user_id == user_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        income_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.account_id == account_id, Transaction.type == "income", Transaction.deleted_at.is_(None))
        )
        expense_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.account_id == account_id, Transaction.type == "expense", Transaction.deleted_at.is_(None))
        )
        count_result = await self.db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.account_id == account_id, Transaction.deleted_at.is_(None))
        )
        total_income = income_result.scalar() or 0
        total_expenses = expense_result.scalar() or 0
        transaction_count = count_result.scalar() or 0
        balance = float(account.balance or 0)
        return {
            **{c.name: getattr(account, c.name) for c in account.__table__.columns},
            "balance": round(balance, 2),
            "total_income": float(total_income),
            "total_expenses": float(total_expenses),
            "transaction_count": transaction_count,
        }

    async def _enrich_batch(self, accounts: list[Account]) -> list[Account]:
        # IMPORTANT: never mutate the persistent `balance` column here.
        # `balance` is a maintained running total (see transaction_service),
        # so we return the accounts as-is to avoid corrupting stored values.
        return accounts
