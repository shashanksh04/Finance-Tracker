from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Any, Optional
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.sync_service import SyncService

router = APIRouter(prefix="/api/sync", tags=["Sync"])


class PushRequest(BaseModel):
    changes: dict[str, dict[str, list[dict[str, Any]]]]


@router.get("/pull")
async def pull_changes(
    last_pulled_at: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SyncService(db)
    return await service.pull_changes(user.id, last_pulled_at)


@router.post("/push")
async def push_changes(
    data: PushRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SyncService(db)
    return await service.push_changes(user.id, data.changes)
