from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.analysis import PeriodAnalysisResponse, DashboardSummary, CashflowProjectionResponse
from app.services.analysis_service import AnalysisService
from typing import Optional

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AnalysisService(db)
    return await service.get_dashboard_summary(user.id)


@router.get("/period", response_model=PeriodAnalysisResponse)
async def get_period_analysis(
    period: str = Query("monthly"),
    year: int = Query(None),
    month: Optional[int] = Query(None),
    quarter: Optional[int] = Query(None),
    account_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import datetime
    if year is None:
        year = datetime.date.today().year
    currency = (user.settings or {}).get("currency", "USD")
    service = AnalysisService(db)
    return await service.get_period_analysis(user.id, period, year, month, quarter, account_id, category_id, currency)


@router.get("/net-worth-trend")
async def get_net_worth_trend(
    months: int = Query(12, ge=1, le=120),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_net_worth_trend(user.id, months)


@router.get("/calendar")
async def get_calendar(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_calendar(user.id, year, month)


@router.get("/cashflow", response_model=CashflowProjectionResponse)
async def get_cashflow(
    days: int = Query(90, ge=7, le=365),
    account_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    return await service.get_cashflow_projection(
        user_id=user.id,
        days=days,
        account_id=account_id,
        currency=(user.settings or {}).get("currency", "USD"),
    )
