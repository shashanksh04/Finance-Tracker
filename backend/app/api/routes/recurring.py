from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.recurring import RecurringCreate, RecurringUpdate, RecurringResponse
from app.services.recurring_service import RecurringService
from app.ws.events import notify_dashboard_updated
from typing import List

router = APIRouter(prefix="/api/recurring", tags=["Recurring Transactions"])


@router.get("/", response_model=List[RecurringResponse])
async def list_recurring(active_only: bool = Query(False), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = RecurringService(db)
    return await service.get_all(user.id, active_only)


@router.post("/", response_model=RecurringResponse)
async def create_recurring(data: RecurringCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = RecurringService(db)
    result = await service.create(user.id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.get("/{recurring_id}", response_model=RecurringResponse)
async def get_recurring(recurring_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = RecurringService(db)
    return await service.get_by_id(user.id, recurring_id)


@router.put("/{recurring_id}", response_model=RecurringResponse)
async def update_recurring(recurring_id: str, data: RecurringUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = RecurringService(db)
    result = await service.update(user.id, recurring_id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.delete("/{recurring_id}")
async def delete_recurring(recurring_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = RecurringService(db)
    await service.delete(user.id, recurring_id)
    await notify_dashboard_updated(user.id)
    return {"message": "Recurring transaction deleted"}
