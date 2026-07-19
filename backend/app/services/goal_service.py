from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalUpdate
from fastapi import HTTPException, status
from datetime import date


class GoalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, data: GoalCreate) -> dict:
        goal = Goal(user_id=user_id, **data.model_dump())
        self.db.add(goal)
        await self.db.flush()
        await self.db.refresh(goal, ['category'])
        return await self._enrich(goal)

    async def get_all(self, user_id: str, status_filter: str = None, page: int = 0, page_size: int = 0) -> list[dict] | dict:
        query = select(Goal).options(joinedload(Goal.category)).where(Goal.user_id == user_id)
        if status_filter:
            query = query.where(Goal.status == status_filter)
        query = query.order_by(Goal.created_at.desc())
        if page > 0 and page_size > 0:
            count_query = select(func.count()).select_from(query.subquery())
            total = (await self.db.execute(count_query)).scalar() or 0
            query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        goals = list(result.unique().scalars().all())
        enriched = [await self._enrich(g) for g in goals]
        if page > 0 and page_size > 0:
            return {
                "items": enriched,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }
        return enriched

    async def get_by_id(self, user_id: str, goal_id: str) -> dict:
        result = await self.db.execute(
            select(Goal).options(joinedload(Goal.category)).where(Goal.id == goal_id, Goal.user_id == user_id)
        )
        goal = result.unique().scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        return await self._enrich(goal)

    async def update(self, user_id: str, goal_id: str, data: GoalUpdate) -> dict:
        result = await self.db.execute(
            select(Goal).options(joinedload(Goal.category)).where(Goal.id == goal_id, Goal.user_id == user_id)
        )
        goal = result.unique().scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(goal, field, value)
        await self.db.flush()
        await self.db.refresh(goal, ['category'])
        return await self._enrich(goal)

    async def delete(self, user_id: str, goal_id: str) -> bool:
        result = await self.db.execute(
            select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        await self.db.delete(goal)
        await self.db.flush()
        return True

    async def _enrich(self, goal: Goal) -> dict:
        target = float(goal.target_amount)
        current = float(goal.current_amount)
        progress = round((current / target * 100), 1) if target > 0 else 0
        days_remaining = None
        suggested = None
        if goal.deadline:
            delta = (goal.deadline - date.today()).days
            days_remaining = max(0, delta)
            if days_remaining > 0:
                remaining = target - current
                suggested = round(remaining / days_remaining * 30, 2) if remaining > 0 else 0
        cat_name = None
        if goal.category:
            cat_name = goal.category.name
        return {
            "id": goal.id,
            "user_id": goal.user_id,
            "name": goal.name,
            "target_amount": target,
            "current_amount": current,
            "deadline": goal.deadline.isoformat() if goal.deadline else None,
            "category_id": goal.category_id,
            "category_name": cat_name,
            "icon": goal.icon,
            "color": goal.color,
            "status": goal.status,
            "monthly_contribution": float(goal.monthly_contribution) if goal.monthly_contribution else None,
            "notes": goal.notes,
            "progress_percentage": progress,
            "days_remaining": days_remaining,
            "suggested_monthly": suggested,
            "created_at": goal.created_at.isoformat() if goal.created_at else None,
            "updated_at": goal.updated_at.isoformat() if goal.updated_at else None,
        }
