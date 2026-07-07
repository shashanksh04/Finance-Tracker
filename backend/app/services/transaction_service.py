from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, asc
from sqlalchemy.orm import joinedload
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionFilterParams
from fastapi import HTTPException, status
import math


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: TransactionCreate) -> Transaction:
        account = await self.db.execute(select(Account).where(Account.id == data.account_id, Account.user_id == user_id))
        if not account.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Account not found")
        txn = Transaction(user_id=user_id, **data.model_dump())
        self.db.add(txn)
        await self.db.flush()
        return await self._load_relations(txn)

    async def get_filtered(self, user_id: str, filters: TransactionFilterParams) -> dict:
        query = select(Transaction).options(joinedload(Transaction.account), joinedload(Transaction.category)).where(Transaction.user_id == user_id)
        if filters.account_id:
            query = query.where(Transaction.account_id == filters.account_id)
        if filters.category_id:
            query = query.where(Transaction.category_id == filters.category_id)
        if filters.type:
            query = query.where(Transaction.type == filters.type)
        if filters.start_date:
            query = query.where(Transaction.date >= filters.start_date)
        if filters.end_date:
            query = query.where(Transaction.date <= filters.end_date)
        if filters.min_amount is not None:
            query = query.where(Transaction.amount >= filters.min_amount)
        if filters.max_amount is not None:
            query = query.where(Transaction.amount <= filters.max_amount)
        if filters.merchant:
            query = query.where(Transaction.merchant.ilike(f"%{filters.merchant}%"))
        if filters.search:
            pattern = f"%{filters.search}%"
            query = query.where(
                Transaction.description.ilike(pattern) | Transaction.merchant.ilike(pattern) | Transaction.notes.ilike(pattern)
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0
        sort_col = getattr(Transaction, filters.sort_by, Transaction.date)
        order_fn = desc if filters.sort_order == "desc" else asc
        query = query.order_by(order_fn(sort_col))
        offset = (filters.page - 1) * filters.page_size
        query = query.offset(offset).limit(filters.page_size)
        result = await self.db.execute(query)
        items = list(result.unique().scalars().all())
        enriched = []
        for t in items:
            try:
                enriched.append(await self._enrich(t))
            except Exception as e:
                enriched.append(self._enrich_fallback(t, str(e)))
        return {
            "items": enriched,
            "total": total,
            "page": filters.page,
            "page_size": filters.page_size,
            "total_pages": math.ceil(total / filters.page_size) if total > 0 else 0,
        }

    def _enrich_fallback(self, txn: Transaction, error: str = "") -> dict:
        return {
            "id": txn.id,
            "account_id": txn.account_id,
            "account_name": getattr(txn, 'account', None) and getattr(txn.account, 'name', '') or '',
            "user_id": txn.user_id,
            "category_id": txn.category_id,
            "category_name": getattr(getattr(txn, 'category', None), 'name', None),
            "category_icon": getattr(getattr(txn, 'category', None), 'icon', None),
            "category_color": getattr(getattr(txn, 'category', None), 'color', None),
            "amount": float(txn.amount),
            "type": txn.type,
            "description": txn.description,
            "merchant": txn.merchant,
            "date": txn.date.isoformat() if txn.date else None,
            "is_recurring": txn.is_recurring,
            "notes": txn.notes,
            "tags": txn.tags,
            "created_at": txn.created_at.isoformat() if txn.created_at else None,
            "updated_at": txn.updated_at.isoformat() if txn.updated_at else None,
        }

    async def get_by_id(self, user_id: str, txn_id: str) -> Transaction:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user_id)
        )
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return await self._enrich(txn)

    async def update(self, user_id: str, txn_id: str, data: TransactionUpdate) -> Transaction:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user_id)
        )
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(txn, field, value)
        await self.db.flush()
        return await self._enrich(txn)

    async def delete(self, user_id: str, txn_id: str) -> bool:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user_id)
        )
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        await self.db.delete(txn)
        await self.db.flush()
        return True

    async def _load_relations(self, txn: Transaction) -> Transaction:
        await self.db.refresh(txn, ["account", "category"])
        return txn

    async def _enrich(self, txn: Transaction) -> dict:
        account_name = ""
        category_name = None
        category_icon = None
        category_color = None
        if txn.account:
            account_name = txn.account.name
        if txn.category:
            category_name = txn.category.name
            category_icon = txn.category.icon
            category_color = txn.category.color
        return {
            "id": txn.id,
            "account_id": txn.account_id,
            "account_name": account_name,
            "user_id": txn.user_id,
            "category_id": txn.category_id,
            "category_name": category_name,
            "category_icon": category_icon,
            "category_color": category_color,
            "amount": float(txn.amount),
            "type": txn.type,
            "description": txn.description,
            "merchant": txn.merchant,
            "date": txn.date.isoformat() if txn.date else None,
            "is_recurring": txn.is_recurring,
            "notes": txn.notes,
            "tags": txn.tags,
            "created_at": txn.created_at.isoformat() if txn.created_at else None,
            "updated_at": txn.updated_at.isoformat() if txn.updated_at else None,
        }
