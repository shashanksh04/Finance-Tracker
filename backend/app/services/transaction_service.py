from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, asc
from sqlalchemy.orm import joinedload
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionFilterParams
from fastapi import HTTPException, status
import math
from datetime import datetime, timezone


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: TransactionCreate) -> Transaction:
        result = await self.db.execute(select(Account).where(Account.id == data.account_id, Account.user_id == user_id, Account.deleted_at.is_(None)).with_for_update())
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        category_id = data.category_id
        auto_rule_id = None
        if not category_id:
            from app.services.category_rule_service import CategoryRuleService
            rule_service = CategoryRuleService(self.db)
            matched_category_id, matched_rule_id = await rule_service.match_transaction(
                user_id,
                data.description,
                data.merchant,
                float(data.amount) if data.amount is not None else None,
            )
            if matched_category_id:
                category_id = matched_category_id
                auto_rule_id = matched_rule_id
        txn_data = data.model_dump()
        txn_data["category_id"] = category_id
        txn = Transaction(user_id=user_id, auto_rule_id=auto_rule_id, **txn_data)
        self.db.add(txn)
        amount = _to_decimal(data.amount)
        cur = _to_decimal(account.balance)
        if data.type == "income":
            account.balance = cur + amount
        else:
            account.balance = cur - amount
        if auto_rule_id:
            from app.services.category_rule_service import CategoryRuleService
            await CategoryRuleService(self.db).record_hit(auto_rule_id)
        await self.db.flush()
        return await self._enrich(txn)

    async def get_filtered(self, user_id: str, filters: TransactionFilterParams) -> dict:
        query = select(Transaction).options(joinedload(Transaction.account), joinedload(Transaction.category)).where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
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
            esc = _escape_like(filters.merchant)
            query = query.where(Transaction.merchant.ilike(f"%{esc}%", escape="\\"))
        if filters.search:
            esc = _escape_like(filters.search)
            pattern = f"%{esc}%"
            query = query.where(
                Transaction.description.ilike(pattern, escape="\\") | Transaction.merchant.ilike(pattern, escape="\\") | Transaction.notes.ilike(pattern, escape="\\")
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0
        VALID_SORT_COLUMNS = {"date", "amount", "created_at", "updated_at", "description", "merchant"}
        sort_by = filters.sort_by if filters.sort_by in VALID_SORT_COLUMNS else "date"
        sort_col = getattr(Transaction, sort_by, Transaction.date)
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
            select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
        )
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return await self._enrich(txn)

    async def update(self, user_id: str, txn_id: str, data: TransactionUpdate) -> Transaction:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user_id, Transaction.deleted_at.is_(None)).with_for_update()
        )
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        old_amount = _to_decimal(txn.amount)
        old_type = txn.type
        old_account_id = txn.account_id
        old_category_id = txn.category_id
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(txn, field, value)
        if data.category_id is not None and data.category_id != old_category_id:
            from app.services.category_rule_service import CategoryRuleService
            await CategoryRuleService(self.db).learn_from_correction(user_id, txn, old_category_id, data.category_id)
        new_account_id = txn.account_id
        new_amount = _to_decimal(txn.amount)
        new_type = txn.type
        if old_account_id and old_account_id == new_account_id:
            res = await self.db.execute(select(Account).where(Account.id == old_account_id, Account.deleted_at.is_(None)).with_for_update())
            acct = res.scalar_one_or_none()
            if acct:
                cur = _to_decimal(acct.balance)
                refund = old_amount if old_type == "expense" else -old_amount
                charge = new_amount if new_type == "income" else -new_amount
                acct.balance = cur + refund + charge
        else:
            if old_account_id:
                res_old = await self.db.execute(select(Account).where(Account.id == old_account_id).with_for_update())
                old_account = res_old.scalar_one_or_none()
                if old_account:
                    old_account.balance = _to_decimal(old_account.balance) + (old_amount if old_type == "expense" else -old_amount)
            if new_account_id:
                res_new = await self.db.execute(select(Account).where(Account.id == new_account_id, Account.deleted_at.is_(None)).with_for_update())
                new_account = res_new.scalar_one_or_none()
                if new_account:
                    new_account.balance = _to_decimal(new_account.balance) + (new_amount if new_type == "income" else -new_amount)
        await self.db.flush()
        await self.db.refresh(txn)
        return await self._enrich(txn)

    async def delete(self, user_id: str, txn_id: str) -> bool:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user_id, Transaction.deleted_at.is_(None)).with_for_update()
        )
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        txn.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        res = await self.db.execute(select(Account).where(Account.id == txn.account_id).with_for_update())
        account = res.scalar_one_or_none()
        if account:
            amt = _to_decimal(txn.amount)
            account.balance = _to_decimal(account.balance) + (amt if txn.type == "expense" else -amt)
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
        if getattr(txn, "account", None) is not None and txn.account:
            account_name = txn.account.name
        elif txn.account_id:
            acct = await self.db.get(Account, txn.account_id)
            if acct:
                account_name = acct.name
        if getattr(txn, "category", None) is not None and txn.category:
            category_name = txn.category.name
            category_icon = txn.category.icon
            category_color = txn.category.color
        elif txn.category_id:
            cat = await self.db.get(Category, txn.category_id)
            if cat:
                category_name = cat.name
                category_icon = cat.icon
                category_color = cat.color
        return {
            "id": txn.id,
            "account_id": txn.account_id,
            "account_name": account_name,
            "user_id": txn.user_id,
            "category_id": txn.category_id,
            "auto_rule_id": txn.auto_rule_id,
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
