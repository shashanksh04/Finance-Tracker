from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.bill import BillCreate, BillUpdate, BillResponse, BillUploadResponse
from app.services.bill_service import BillService
from app.ws.events import notify_dashboard_updated, notify_alerts_updated
from typing import List

router = APIRouter(prefix="/api/bills", tags=["Bills"])


@router.get("/", response_model=List[BillResponse])
async def list_bills(unpaid_only: bool = Query(False), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BillService(db)
    return await service.get_all(user.id, unpaid_only)


@router.post("/", response_model=BillResponse)
async def create_bill(data: BillCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BillService(db)
    result = await service.create(user.id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(bill_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BillService(db)
    return await service.get_by_id(user.id, bill_id)


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(bill_id: str, data: BillUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BillService(db)
    result = await service.update(user.id, bill_id, data)
    await notify_dashboard_updated(user.id)
    await notify_alerts_updated(user.id)
    return result


@router.delete("/{bill_id}")
async def delete_bill(bill_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BillService(db)
    await service.delete(user.id, bill_id)
    await notify_dashboard_updated(user.id)
    return {"message": "Bill deleted"}


@router.post("/{bill_id}/upload", response_model=BillUploadResponse)
async def upload_bill_file(bill_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = BillService(db)
    result = await service.upload_file(user.id, bill_id, file)
    await notify_dashboard_updated(user.id)
    await notify_alerts_updated(user.id)
    return result
