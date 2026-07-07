from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
        query = select(Account).where(Account.user_id == user_id)
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
            select(Account).where(Account.id == account_id, Account.user_id == user_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        enriched = await self._enrich_batch([account])
        return enriched[0]

    async def update(self, user_id: str, account_id: str, data: AccountUpdate) -> Account:
        account = await self.db.execute(
            select(Account).where(Account.id == account_id, Account.user_id == user_id)
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
            select(Account).where(Account.id == account_id, Account.user_id == user_id)
        )
        account = account.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        from app.models.transaction import Transaction
        from app.models.recurring import RecurringTransaction
        await self.db.execute(
            Transaction.__table__.delete().where(Transaction.account_id == account_id)
        )
        await self.db.execute(
            RecurringTransaction.__table__.delete().where(RecurringTransaction.account_id == account_id)
        )
        await self.db.delete(account)
        await self.db.flush()
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
            .where(Transaction.account_id == account_id, Transaction.type == "income")
        )
        expense_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.account_id == account_id, Transaction.type == "expense")
        )
        count_result = await self.db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.account_id == account_id)
        )
        total_income = income_result.scalar() or 0
        total_expenses = expense_result.scalar() or 0
        transaction_count = count_result.scalar() or 0
        return {
            **{c.name: getattr(account, c.name) for c in account.__table__.columns},
            "balance": float(account.balance),
            "total_income": float(total_income),
            "total_expenses": float(total_expenses),
            "transaction_count": transaction_count,
        }

    async def _enrich_batch(self, accounts: list[Account]) -> list[Account]:
        if not accounts:
            return accounts
        ids = [a.id for a in accounts]
        income_rows = await self.db.execute(
            select(Transaction.account_id, func.coalesce(func.sum(Transaction.amount), 0).label("total"))
            .where(Transaction.account_id.in_(ids), Transaction.type == "income")
            .group_by(Transaction.account_id)
        )
        expense_rows = await self.db.execute(
            select(Transaction.account_id, func.coalesce(func.sum(Transaction.amount), 0).label("total"))
            .where(Transaction.account_id.in_(ids), Transaction.type == "expense")
            .group_by(Transaction.account_id)
        )
        income_map = {row.account_id: float(row.total) for row in income_rows.all()}
        expense_map = {row.account_id: float(row.total) for row in expense_rows.all()}
        for a in accounts:
            income = income_map.get(a.id, 0)
            expense = expense_map.get(a.id, 0)
            net = income - expense
            setattr(a, 'balance', float(net))
        return accounts
