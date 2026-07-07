from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse
from app.services.budget_service import BudgetService
from app.ws.events import notify_dashboard_updated
from typing import List

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])


@router.get("/")
async def list_budgets(active_only: bool = Query(False), page: int = Query(0, ge=0), page_size: int = Query(0, ge=0, le=100), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BudgetService(db)
    return await service.get_all(user.id, active_only, page, page_size)


@router.post("/", response_model=BudgetResponse)
async def create_budget(data: BudgetCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BudgetService(db)
    result = await service.create(user.id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(budget_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BudgetService(db)
    return await service.get_by_id(user.id, budget_id)


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(budget_id: str, data: BudgetUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BudgetService(db)
    result = await service.update(user.id, budget_id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.delete("/{budget_id}")
async def delete_budget(budget_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BudgetService(db)
    await service.delete(user.id, budget_id)
    await notify_dashboard_updated(user.id)
    return {"message": "Budget deleted"}
