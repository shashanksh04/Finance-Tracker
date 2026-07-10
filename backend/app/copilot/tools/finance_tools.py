from decimal import Decimal
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.budget import Budget
from app.models.bill import Bill
from app.models.goal import Goal
from app.models.account import Account
from app.services.analysis_service import AnalysisService


def _currency_symbol(user) -> str:
    cur = (user.settings or {}).get("currency", "USD") if user else "USD"
    sym = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥",
           "CAD": "C$", "AUD": "A$", "SGD": "S$", "CHF": "Fr", "CNY": "¥"}
    return sym.get(cur, "$")


async def get_spending_by_category(
    db: AsyncSession,
    user_id: str,
    user,
    category_name: Optional[str] = None,
    period: str = "this_month",
    type: str = "expense",
) -> dict:
    today = date.today()
    if period == "this_month":
        start = today.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
    elif period == "last_month":
        end = today.replace(day=1)
        start = (end - timedelta(days=1)).replace(day=1)
    elif period == "this_year":
        start = today.replace(month=1, day=1)
        end = today.replace(year=today.year + 1, month=1, day=1)
    elif period == "last_3_months":
        end = today.replace(day=1)
        start = (end - timedelta(days=90)).replace(day=1)
    else:
        start = today.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)

    where = [
        Transaction.user_id == user_id,
        Transaction.date >= start,
        Transaction.date < end,
        Transaction.type == type,
    ]
    if category_name:
        cat_result = await db.execute(
            select(Category).where(
                Category.user_id == user_id,
                func.lower(Category.name).contains(category_name.lower()),
            )
        )
        cat = cat_result.scalar_one_or_none()
        if cat:
            where.append(Transaction.category_id == cat.id)
        else:
            return {"error": f"Category '{category_name}' not found", "items": []}

    query = select(
        Transaction.category_id,
        func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        func.count(Transaction.id).label("count"),
    ).where(and_(*where)).group_by(Transaction.category_id)
    result = await db.execute(query)
    rows = result.all()

    cat_ids = [r.category_id for r in rows if r.category_id]
    cat_map = {}
    if cat_ids:
        cats = await db.execute(select(Category).where(Category.id.in_(cat_ids)))
        for c in cats.scalars().all():
            cat_map[c.id] = c

    sym = _currency_symbol(user)
    items = []
    total_spent = 0
    for r in rows:
        name = "Uncategorized"
        if r.category_id and r.category_id in cat_map:
            name = cat_map[r.category_id].name
        items.append({
            "category": name,
            "amount": float(r.total),
            "count": r.count,
            "formatted": f"{sym}{float(r.total):.2f}",
        })
        total_spent += float(r.total)

    return {
        "period": period,
        "type": type,
        "total": round(total_spent, 2),
        "formatted_total": f"{sym}{total_spent:.2f}",
        "items": items,
    }


async def get_budget_health(
    db: AsyncSession,
    user_id: str,
    user,
) -> dict:
    from sqlalchemy.orm import joinedload
    today = date.today()
    month_start = today.replace(day=1)
    month_end = (month_start + timedelta(days=32)).replace(day=1)

    budget_result = await db.execute(
        select(Budget).options(joinedload(Budget.category))
        .where(Budget.user_id == user_id, Budget.is_active == True)
    )
    budgets = list(budget_result.unique().scalars().all())

    if not budgets:
        return {"budgets": [], "message": "No active budgets found"}

    cat_ids = [b.category_id for b in budgets if b.category_id]
    spent_map = {}
    if cat_ids:
        spent_rows = await db.execute(
            select(Transaction.category_id,
                   func.coalesce(func.sum(Transaction.amount), 0).label("total"))
            .where(Transaction.user_id == user_id,
                   Transaction.date >= month_start,
                   Transaction.date < month_end,
                   Transaction.type == "expense",
                   Transaction.category_id.in_(cat_ids))
            .group_by(Transaction.category_id)
        )
        spent_map = {row.category_id: float(row.total) for row in spent_rows.all()}

    sym = _currency_symbol(user)
    results = []
    for b in budgets:
        spent = spent_map.get(b.category_id, 0)
        pct = round(float(spent) / float(b.amount) * 100, 1) if float(b.amount) > 0 else 0
        results.append({
            "category": b.category.name if b.category else "Overall",
            "budgeted": float(b.amount),
            "spent": spent,
            "remaining": float(b.amount) - spent,
            "percentage": pct,
            "formatted_budgeted": f"{sym}{float(b.amount):.2f}",
            "formatted_spent": f"{sym}{spent:.2f}",
            "formatted_remaining": f"{sym}{float(b.amount) - spent:.2f}",
            "status": "over" if pct > 100 else "warning" if pct > 80 else "on_track",
        })

    return {"budgets": results}


async def get_recent_transactions(
    db: AsyncSession,
    user_id: str,
    user,
    limit: int = 10,
    category: Optional[str] = None,
    merchant: Optional[str] = None,
) -> dict:
    where = [Transaction.user_id == user_id]
    if category:
        cat_result = await db.execute(
            select(Category).where(
                Category.user_id == user_id,
                func.lower(Category.name).contains(category.lower()),
            )
        )
        cat = cat_result.scalar_one_or_none()
        if cat:
            where.append(Transaction.category_id == cat.id)
    if merchant:
        where.append(func.lower(Transaction.merchant).contains(merchant.lower()))

    query = select(Transaction).where(and_(*where)).order_by(Transaction.date.desc()).limit(limit)
    result = await db.execute(query)
    txns = result.scalars().all()
    sym = _currency_symbol(user)

    items = []
    for t in txns:
        items.append({
            "id": t.id,
            "description": t.description,
            "amount": float(t.amount),
            "formatted": f"{sym}{float(t.amount):.2f}",
            "type": t.type,
            "merchant": t.merchant,
            "date": t.date.isoformat() if t.date else None,
            "category_id": t.category_id,
        })

    return {"transactions": items, "count": len(items)}


async def get_upcoming_bills(
    db: AsyncSession,
    user_id: str,
    user,
    days: int = 7,
) -> dict:
    today = date.today()
    cutoff = today + timedelta(days=days)
    result = await db.execute(
        select(Bill).where(
            Bill.user_id == user_id,
            Bill.is_paid == False,
            Bill.due_date >= today,
            Bill.due_date <= cutoff,
        ).order_by(Bill.due_date)
    )
    bills = result.scalars().all()
    sym = _currency_symbol(user)

    items = []
    for b in bills:
        items.append({
            "id": b.id,
            "name": b.name,
            "amount": float(b.amount),
            "formatted": f"{sym}{float(b.amount):.2f}",
            "due_date": b.due_date.isoformat(),
            "days_until": (b.due_date - today).days,
        })

    return {
        "bills": items,
        "count": len(items),
        "total_due": round(sum(float(b.amount) for b in bills), 2),
        "formatted_total": f"{sym}{sum(float(b.amount) for b in bills):.2f}",
    }


async def compare_periods(
    db: AsyncSession,
    user_id: str,
    user,
    period_a: str = "last_month",
    period_b: str = "this_month",
    category: Optional[str] = None,
) -> dict:
    analysis = AnalysisService(db)

    async def get_period_data(period_label):
        today = date.today()
        if period_label == "this_month":
            start = today.replace(day=1)
            end = (start + timedelta(days=32)).replace(day=1)
        elif period_label == "last_month":
            end = today.replace(day=1)
            start = (end - timedelta(days=1)).replace(day=1)
        elif period_label == "this_year":
            start = today.replace(month=1, day=1)
            end = today.replace(year=today.year + 1, month=1, day=1)
        elif period_label == "last_year":
            start = today.replace(year=today.year - 1, month=1, day=1)
            end = today.replace(year=today.year, month=1, day=1)
        else:
            start = today.replace(day=1)
            end = (start + timedelta(days=32)).replace(day=1)
        return await analysis._analyze_period(user_id, start, end)

    data_a = await get_period_data(period_a)
    data_b = await get_period_data(period_b)
    sym = _currency_symbol(user)

    return {
        "period_a": {"label": period_a, "income": data_a["total_income"], "expenses": data_a["total_expenses"]},
        "period_b": {"label": period_b, "income": data_b["total_income"], "expenses": data_b["total_expenses"]},
        "change": {
            "income": round(data_b["total_income"] - data_a["total_income"], 2),
            "expenses": round(data_b["total_expenses"] - data_a["total_expenses"], 2),
            "formatted_income": f"{sym}{data_b['total_income'] - data_a['total_income']:+.2f}",
            "formatted_expenses": f"{sym}{data_b['total_expenses'] - data_a['total_expenses']:+.2f}",
        },
    }


async def get_goal_progress(
    db: AsyncSession,
    user_id: str,
    user,
    status: str = "active",
) -> dict:
    result = await db.execute(
        select(Goal).where(Goal.user_id == user_id, Goal.status == status)
    )
    goals = result.scalars().all()
    sym = _currency_symbol(user)

    items = []
    for g in goals:
        progress = round(float(g.current_amount) / float(g.target_amount) * 100, 1) if float(g.target_amount) > 0 else 0
        remaining = float(g.target_amount) - float(g.current_amount)
        items.append({
            "id": g.id,
            "name": g.name,
            "target": float(g.target_amount),
            "current": float(g.current_amount),
            "remaining": round(remaining, 2),
            "progress_percentage": progress,
            "deadline": g.deadline.isoformat() if g.deadline else None,
            "formatted_target": f"{sym}{float(g.target_amount):.2f}",
            "formatted_current": f"{sym}{float(g.current_amount):.2f}",
            "formatted_remaining": f"{sym}{remaining:.2f}",
        })

    return {"goals": items, "count": len(items)}


async def get_goal_spending_impact(
    db: AsyncSession,
    user_id: str,
    user,
) -> dict:
    today = date.today()
    month_start = today.replace(day=1)
    month_end = (month_start + timedelta(days=32)).replace(day=1)

    result = await db.execute(
        select(Goal).where(Goal.user_id == user_id)
    )
    goals = result.scalars().all()

    expense_r = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "expense")
    )
    income_r = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "income")
    )
    monthly_expense = float(expense_r.scalar() or 0)
    monthly_income = float(income_r.scalar() or 0)
    surplus = monthly_income - monthly_expense

    items = []
    for g in goals:
        target = float(g.target_amount)
        current = float(g.current_amount)
        remaining = target - current
        suggested_monthly = None
        if g.deadline:
            delta = (g.deadline - today).days
            days = max(0, delta)
            if days > 0 and remaining > 0:
                suggested_monthly = round(remaining / days * 30, 2)
        impact = "neutral"
        if suggested_monthly and surplus > 0:
            if suggested_monthly > surplus:
                impact = "at_risk"
            elif surplus >= suggested_monthly:
                impact = "on_track"
        elif suggested_monthly and surplus <= 0:
            impact = "at_risk"

        items.append({
            "goal_name": g.name,
            "target": target,
            "current": current,
            "remaining": round(remaining, 2),
            "progress_percentage": round(current / target * 100, 1) if target > 0 else 0,
            "suggested_monthly": suggested_monthly,
            "monthly_surplus": round(surplus, 2),
            "impact": impact,
        })

    return {
        "goals": items,
        "monthly_income": round(monthly_income, 2),
        "monthly_expenses": round(monthly_expense, 2),
        "monthly_surplus": round(surplus, 2),
        "count": len(items),
    }


async def get_accounts(
    db: AsyncSession,
    user_id: str,
    user,
) -> dict:
    result = await db.execute(
        select(Account).where(
            Account.user_id == user_id,
            Account.is_archived == False,
        ).order_by(Account.name)
    )
    accounts = result.scalars().all()
    sym = _currency_symbol(user)

    items = []
    for a in accounts:
        items.append({
            "id": a.id,
            "name": a.name,
            "type": a.type,
            "balance": float(a.balance) if a.balance else 0,
            "formatted_balance": f"{sym}{float(a.balance):.2f}" if a.balance else f"{sym}0.00",
            "currency": a.currency or "INR",
        })

    return {"accounts": items, "count": len(items)}


async def get_income_summary(
    db: AsyncSession,
    user_id: str,
    user,
    period: str = "this_month",
    account_name: Optional[str] = None,
) -> dict:
    today = date.today()
    if period == "this_month":
        start = today.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
    elif period == "last_month":
        end = today.replace(day=1)
        start = (end - timedelta(days=1)).replace(day=1)
    elif period == "this_year":
        start = today.replace(month=1, day=1)
        end = today.replace(year=today.year + 1, month=1, day=1)
    elif period == "last_3_months":
        end = today.replace(day=1)
        start = (end - timedelta(days=90)).replace(day=1)
    elif period == "all":
        start = date(2000, 1, 1)
        end = today + timedelta(days=1)
    else:
        start = today.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)

    where = [
        Transaction.user_id == user_id,
        Transaction.date >= start,
        Transaction.date < end,
        Transaction.type == "income",
    ]

    if account_name:
        acct_result = await db.execute(
            select(Account).where(
                Account.user_id == user_id,
                func.lower(Account.name).contains(account_name.lower()),
            )
        )
        acct = acct_result.scalar_one_or_none()
        if acct:
            where.append(Transaction.account_id == acct.id)
        else:
            return {"error": f"Account '{account_name}' not found", "items": []}

    query = select(
        func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        func.count(Transaction.id).label("count"),
    ).where(and_(*where))
    result = await db.execute(query)
    row = result.one()

    cat_query = select(
        Transaction.category_id,
        func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        func.count(Transaction.id).label("count"),
    ).where(and_(*where)).group_by(Transaction.category_id)
    cat_result = await db.execute(cat_query)
    cat_rows = cat_result.all()

    cat_ids = [r.category_id for r in cat_rows if r.category_id]
    cat_map = {}
    if cat_ids:
        cats = await db.execute(select(Category).where(Category.id.in_(cat_ids)))
        for c in cats.scalars().all():
            cat_map[c.id] = c

    sym = _currency_symbol(user)
    sources = []
    for r in cat_rows:
        name = "Uncategorized"
        if r.category_id and r.category_id in cat_map:
            name = cat_map[r.category_id].name
        sources.append({
            "source": name,
            "amount": float(r.total),
            "formatted": f"{sym}{float(r.total):.2f}",
            "count": r.count,
        })

    return {
        "period": period,
        "total_income": float(row.total),
        "formatted_total": f"{sym}{float(row.total):.2f}",
        "transaction_count": row.count,
        "sources": sources,
    }
