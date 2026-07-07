from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.alert import AlertResponse, AlertPreferenceUpdate, AlertPreferenceResponse
from app.services.alert_service import AlertService
from app.ws.events import notify_alerts_updated, notify_alert_read, notify_alert_dismissed
from typing import List

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(unread_only: bool = Query(False), limit: int = Query(50), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AlertService(db)
    return await service.get_alerts(user.id, unread_only, limit)


@router.post("/{alert_id}/read")
async def mark_read(alert_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AlertService(db)
    await service.mark_read(user.id, alert_id)
    await notify_alert_read(user.id, alert_id)
    return {"message": "Alert marked as read"}


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AlertService(db)
    await service.dismiss(user.id, alert_id)
    await notify_alert_dismissed(user.id, alert_id)
    return {"message": "Alert dismissed"}


@router.get("/preferences", response_model=List[AlertPreferenceResponse])
async def get_preferences(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AlertService(db)
    return await service.get_preferences(user.id)


@router.put("/preferences/{alert_type}", response_model=AlertPreferenceResponse)
async def update_preference(alert_type: str, data: AlertPreferenceUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AlertService(db)
    return await service.update_preference(user.id, alert_type, data.enabled, data.threshold)


@router.post("/generate")
async def generate_alerts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AlertService(db)
    alerts = await service.generate_alerts(user.id)
    await notify_alerts_updated(user.id)
    await notify_dashboard_updated(user.id)
    return {"message": f"{len(alerts)} alerts generated", "count": len(alerts)}
