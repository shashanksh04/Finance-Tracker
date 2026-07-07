from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse, AccountSummary
from app.services.account_service import AccountService
from app.ws.events import notify_dashboard_updated
from typing import List

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.get("/")
async def list_accounts(include_archived: bool = Query(False), page: int = Query(0, ge=0), page_size: int = Query(0, ge=0, le=100), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AccountService(db)
    return await service.get_all(user.id, include_archived, page, page_size)


@router.post("/", response_model=AccountResponse)
async def create_account(data: AccountCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AccountService(db)
    result = await service.create(user.id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(account_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AccountService(db)
    return await service.get_by_id(user.id, account_id)


@router.get("/{account_id}/summary", response_model=AccountSummary)
async def get_account_summary(account_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AccountService(db)
    return await service.get_summary(user.id, account_id)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(account_id: str, data: AccountUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AccountService(db)
    result = await service.update(user.id, account_id, data)
    await notify_dashboard_updated(user.id)
    return result


@router.delete("/{account_id}")
async def delete_account(account_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AccountService(db)
    await service.delete(user.id, account_id)
    await notify_dashboard_updated(user.id)
    return {"message": "Account deleted"}
