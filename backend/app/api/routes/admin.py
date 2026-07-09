from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sa_func, cast, Date
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.login_record import LoginRecord
from app.schemas.admin import AdminStatsResponse, DailyLoginCount

router = APIRouter(prefix="/api/admin", tags=["Admin"])


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    total = await db.execute(select(sa_func.count(User.id)))
    total_users = total.scalar() or 0

    from datetime import date, timedelta
    today = date.today()

    today_count = await db.execute(
        select(sa_func.count(LoginRecord.id))
        .where(cast(LoginRecord.created_at, Date) == today)
    )
    today_logins = today_count.scalar() or 0

    seven_days_ago = today - timedelta(days=6)
    rows = await db.execute(
        select(
            cast(LoginRecord.created_at, Date).label("login_date"),
            sa_func.count(LoginRecord.id).label("cnt"),
        )
        .where(cast(LoginRecord.created_at, Date) >= seven_days_ago)
        .group_by(cast(LoginRecord.created_at, Date))
        .order_by(cast(LoginRecord.created_at, Date))
    )
    all_rows = rows.all()
    login_map = {str(r.login_date): r.cnt for r in all_rows}

    daily_logins = []
    for i in range(7):
        d = today - timedelta(days=6 - i)
        daily_logins.append(DailyLoginCount(date=str(d), count=login_map.get(str(d), 0)))

    return AdminStatsResponse(
        total_users=total_users,
        today_logins=today_logins,
        daily_logins=daily_logins,
    )
