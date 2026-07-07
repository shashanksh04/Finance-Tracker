from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse
from app.services.goal_service import GoalService
from app.ws.events import notify_dashboard_updated
from typing import List

router = APIRouter(prefix="/api/goals", tags=["Goals"])


@router.get("/")
async def list_goals(status: str = Query(None), page: int = Query(0, ge=0), page_size: int = Query(0, ge=0, le=100), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = GoalService(db)
    return await service.get_all(user.id, status, page, page_size)


@router.post("/", response_model=GoalResponse)
async def create_goal(data: GoalCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = GoalService(db)
    result = await service.create(user.id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(goal_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = GoalService(db)
    return await service.get_by_id(user.id, goal_id)


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(goal_id: str, data: GoalUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = GoalService(db)
    result = await service.update(user.id, goal_id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.delete("/{goal_id}")
async def delete_goal(goal_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = GoalService(db)
    await service.delete(user.id, goal_id)
    await notify_dashboard_updated(user.id)
    return {"message": "Goal deleted"}
