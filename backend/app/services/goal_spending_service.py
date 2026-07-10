from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.memory import FinancialMemory
from app.embeddings.embedding_service import EmbeddingService


async def detect_goal_spending_conflicts(db: AsyncSession, user_id: str) -> list[dict]:
    today = date.today()
    month_start = today.replace(day=1)
    month_end = (month_start + timedelta(days=32)).replace(day=1)
    last_3_start = (month_start - timedelta(days=90)).replace(day=1)

    goal_r = await db.execute(
        select(Goal).where(Goal.user_id == user_id, Goal.status == "active")
    )
    goals = goal_r.scalars().all()
    if not goals:
        return []

    income_r = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.date >= month_start,
               Transaction.date < month_end, Transaction.type == "income")
    )
    monthly_income = float(income_r.scalar() or 0)

    expense_r = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.date >= month_start,
               Transaction.date < month_end, Transaction.type == "expense")
    )
    monthly_expense = float(expense_r.scalar() or 0)

    avg_expense_r = await db.execute(
        select(func.coalesce(func.avg(sub.c.total), 0))
        .select_from(
            select(func.sum(Transaction.amount).label("total"))
            .where(Transaction.user_id == user_id, Transaction.date >= last_3_start,
                   Transaction.date < month_end, Transaction.type == "expense")
            .group_by(func.date_trunc("month", Transaction.date))
            .subquery()
        )
    )
    avg_monthly_expense = float(avg_expense_r.scalar() or 0) or monthly_expense

    surplus = monthly_income - monthly_expense
    avg_surplus = monthly_income - avg_monthly_expense

    alerts = []
    for g in goals:
        target = float(g.target_amount)
        current = float(g.current_amount)
        remaining = target - current
        if not g.deadline or remaining <= 0:
            continue

        delta = (g.deadline - today).days
        if delta <= 0:
            continue

        suggested_monthly = round(remaining / delta * 30, 2)
        effective_surplus = max(min(surplus, avg_surplus), 0)

        if suggested_monthly > effective_surplus and effective_surplus < suggested_monthly * 0.5:
            deficit = round(suggested_monthly - effective_surplus, 2)
            try:
                insight_text = (
                    f"Goal '{g.name}' needs ₹{suggested_monthly:.0f}/month but your current "
                    f"spending leaves only ₹{effective_surplus:.0f}/month. "
                    f"Consider reducing discretionary spending by ₹{deficit:.0f}/month to stay on track."
                )
                emb = await EmbeddingService.embed(insight_text)
                memory = FinancialMemory(
                    user_id=user_id,
                    key=f"goal_conflict_{g.id}_{today.isoformat()}",
                    value=insight_text,
                    embedding=emb,
                    embedding_vector=emb,
                    memory_type="insight",
                    importance=0.6,
                )
                db.add(memory)
                alerts.append({
                    "goal_id": g.id,
                    "goal_name": g.name,
                    "suggested_monthly": suggested_monthly,
                    "available_surplus": round(effective_surplus, 2),
                    "deficit": deficit,
                    "severity": "high",
                })
            except Exception:
                pass

    await db.flush()
    return alerts
