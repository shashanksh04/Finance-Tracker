from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, PaginatedTransactions
from app.services.transaction_service import TransactionService
from app.ws.events import notify_dashboard_updated
from datetime import date
from typing import Optional

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get("/", response_model=PaginatedTransactions)
async def list_transactions(
    account_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    merchant: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort_by: str = Query("date"),
    sort_order: str = Query("desc"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.schemas.transaction import TransactionFilterParams
    filters = TransactionFilterParams(
        account_id=account_id, category_id=category_id, type=type,
        start_date=start_date, end_date=end_date, min_amount=min_amount,
        max_amount=max_amount, merchant=merchant, search=search,
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order,
    )
    service = TransactionService(db)
    return await service.get_filtered(user.id, filters)


@router.post("/", response_model=TransactionResponse)
async def create_transaction(data: TransactionCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = TransactionService(db)
    txn = await service.create(user.id, data)
    await notify_dashboard_updated(user.id)
    return txn


@router.get("/{txn_id}", response_model=TransactionResponse)
async def get_transaction(txn_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = TransactionService(db)
    return await service.get_by_id(user.id, txn_id)


@router.put("/{txn_id}", response_model=TransactionResponse)
async def update_transaction(txn_id: str, data: TransactionUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = TransactionService(db)
    txn = await service.update(user.id, txn_id, data)
    await notify_dashboard_updated(user.id)
    return txn


@router.delete("/{txn_id}")
async def delete_transaction(txn_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = TransactionService(db)
    await service.delete(user.id, txn_id)
    await notify_dashboard_updated(user.id)
    return {"message": "Transaction deleted"}
