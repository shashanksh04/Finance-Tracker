from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.schemas.budget import BudgetCreate, BudgetUpdate
from fastapi import HTTPException, status
from datetime import date, datetime


class BudgetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: BudgetCreate) -> dict:
        budget = Budget(user_id=user_id, **data.model_dump())
        self.db.add(budget)
        await self.db.flush()
        result = await self.db.execute(
            select(Budget).options(joinedload(Budget.category)).where(Budget.id == budget.id)
        )
        budget = result.unique().scalar_one()
        enriched = await self._enrich_batch([budget])
        return enriched[0]

    async def get_all(self, user_id: str, active_only: bool = False, page: int = 0, page_size: int = 0) -> list[dict] | dict:
        query = select(Budget).options(
            joinedload(Budget.category),
        ).where(Budget.user_id == user_id)
        if active_only:
            query = query.where(Budget.is_active == True)
        query = query.order_by(Budget.created_at.desc())
        if page > 0 and page_size > 0:
            count_query = select(func.count()).select_from(query.subquery())
            total = (await self.db.execute(count_query)).scalar() or 0
            query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        budgets = list(result.unique().scalars().all())
        enriched = await self._enrich_batch(budgets)
        if page > 0 and page_size > 0:
            return {
                "items": enriched,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }
        return enriched

    async def get_by_id(self, user_id: str, budget_id: str) -> dict:
        result = await self.db.execute(
            select(Budget).options(
                joinedload(Budget.category),
            ).where(Budget.id == budget_id, Budget.user_id == user_id)
        )
        budget = result.unique().scalar_one_or_none()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        enriched = await self._enrich_batch([budget])
        return enriched[0]

    async def update(self, user_id: str, budget_id: str, data: BudgetUpdate) -> dict:
        result = await self.db.execute(
            select(Budget).options(
                joinedload(Budget.category),
            ).where(Budget.id == budget_id, Budget.user_id == user_id)
        )
        budget = result.unique().scalar_one_or_none()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(budget, field, value)
        await self.db.flush()
        result = await self.db.execute(
            select(Budget).options(joinedload(Budget.category)).where(Budget.id == budget.id)
        )
        budget = result.unique().scalar_one()
        enriched = await self._enrich_batch([budget])
        return enriched[0]

    async def delete(self, user_id: str, budget_id: str) -> bool:
        result = await self.db.execute(
            select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
        )
        budget = result.scalar_one_or_none()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        await self.db.delete(budget)
        await self.db.flush()
        return True

    async def _enrich_batch(self, budgets: list[Budget]) -> list[dict]:
        if not budgets:
            return []
        now = date.today()
        result = []
        for budget in budgets:
            if budget.period == "monthly":
                start = now.replace(day=1)
                if now.month == 12:
                    end = now.replace(year=now.year + 1, month=1, day=1)
                else:
                    end = now.replace(month=now.month + 1, day=1)
            elif budget.period == "quarterly":
                q = (now.month - 1) // 3
                start = now.replace(month=q * 3 + 1, day=1)
                if q == 3:
                    end = now.replace(year=now.year + 1, month=1, day=1)
                else:
                    end = now.replace(month=(q + 1) * 3 + 1, day=1)
            else:
                start = now.replace(month=1, day=1)
                end = now.replace(year=now.year + 1, month=1, day=1)
            result.append((budget, start, end))
        user_id = budgets[0].user_id
        ranges: dict[tuple[date, date], list[Budget]] = {}
        for budget, start, end in result:
            ranges.setdefault((start, end), []).append(budget)
        spent_map: dict[str, float] = {}
        for (r_start, r_end), group in ranges.items():
            cat_ids = [b.category_id for b in group if b.category_id]
            if not cat_ids:
                continue
            by_range = await self.db.execute(
                select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0).label("total"))
                .where(
                    Transaction.user_id == user_id,
                    Transaction.type == "expense",
                    Transaction.date >= r_start,
                    Transaction.date < r_end,
                    Transaction.category_id.in_(cat_ids),
                )
                .group_by(Transaction.category_id)
            )
            for row in by_range.all():
                spent_map[(row.category_id, r_start, r_end)] = float(row.total)
        uncat_spent_map: dict[tuple[date, date], float] = {}
        for (r_start, r_end), group in ranges.items():
            uncat_budgets = [b for b in group if not b.category_id]
            if not uncat_budgets:
                continue
            row = await self.db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0))
                .where(
                    Transaction.user_id == user_id,
                    Transaction.type == "expense",
                    Transaction.date >= r_start,
                    Transaction.date < r_end,
                )
            )
            uncat_spent_map[(r_start, r_end)] = float(row.scalar() or 0)

        enriched = []
        for budget, start, end in result:
            if budget.category_id:
                spent = spent_map.get((budget.category_id, start, end), 0)
            else:
                spent = uncat_spent_map.get((start, end), 0)
            remaining = float(budget.amount) - spent
            percentage = (spent / float(budget.amount) * 100) if float(budget.amount) > 0 else 0
            cat_name = None
            cat_icon = None
            cat_color = None
            if budget.category:
                cat_name = budget.category.name
                cat_icon = budget.category.icon
                cat_color = budget.category.color
            enriched.append({
                "id": budget.id,
                "user_id": budget.user_id,
                "category_id": budget.category_id,
                "category_name": cat_name,
                "category_icon": cat_icon,
                "category_color": cat_color,
                "amount": float(budget.amount),
                "period": budget.period,
                "start_date": budget.start_date.isoformat() if budget.start_date else None,
                "end_date": budget.end_date.isoformat() if budget.end_date else None,
                "is_active": budget.is_active,
                "rollover": budget.rollover,
                "created_at": budget.created_at.isoformat() if budget.created_at else None,
                "updated_at": budget.updated_at.isoformat() if budget.updated_at else None,
                "spent": round(spent, 2),
                "remaining": round(remaining, 2),
                "percentage": round(percentage, 1),
            })
        return enriched
