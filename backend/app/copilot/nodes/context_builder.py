import asyncio
from datetime import date, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.bill import Bill
from app.copilot.state import CopilotState


def make_context_builder(db: AsyncSession, user):
    async def context_builder(state: CopilotState) -> dict:
        user_id = state["user_id"]
        name = user.full_name if user and user.full_name else "there"
        today = date.today()
        month_start = today.replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        last_month_end = month_start
        last_month_start = (last_month_end - timedelta(days=1)).replace(day=1)

        async def _accounts():
            r = await db.execute(select(Account).where(Account.user_id == user_id, Account.is_archived == False))
            accts = r.scalars().all()
            if not accts:
                return "No accounts set up yet."
            lines = ["Accounts:"]
            for a in accts:
                lines.append(f"  - {a.name} ({a.type}): balance {float(a.balance or 0):.2f}")
            return "\n".join(lines)

        async def _income_period(s, e):
            r = await db.execute(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id, Transaction.date >= s, Transaction.date < e, Transaction.type == "income"))
            return float(r.scalar() or 0)

        async def _expense_period(s, e):
            r = await db.execute(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id, Transaction.date >= s, Transaction.date < e, Transaction.type == "expense"))
            return float(r.scalar() or 0)

        async def _top_categories(s, e):
            r = await db.execute(
                select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0).label("total"))
                .where(Transaction.user_id == user_id, Transaction.date >= s, Transaction.date < e, Transaction.type == "expense")
                .group_by(Transaction.category_id).order_by(func.sum(Transaction.amount).desc()).limit(5))
            rows = r.all()
            if not rows:
                return "None"
            cat_ids = [row.category_id for row in rows if row.category_id]
            cat_map = {}
            if cat_ids:
                cr = await db.execute(select(Category).where(Category.id.in_(cat_ids)))
                for c in cr.scalars():
                    cat_map[c.id] = c.name
            return ", ".join(f"{cat_map.get(rid.category_id, 'Uncategorized')}: {float(rid.total):.2f}" for rid in rows)

        async def _budgets():
            r = await db.execute(select(Budget).where(Budget.user_id == user_id, Budget.is_active == True))
            budgets = r.scalars().all()
            if not budgets:
                return "No active budgets."
            lines = ["Active budgets:"]
            for b in budgets:
                cn = "Overall"
                if b.category_id:
                    c = await db.get(Category, b.category_id)
                    cn = c.name if c else "Unknown"
                lines.append(f"  - {cn}: limit {float(b.amount):.2f}")
            return "\n".join(lines)

        async def _goals():
            r = await db.execute(select(Goal).where(Goal.user_id == user_id))
            goals = r.scalars().all()
            if not goals:
                return "No goals."
            lines = ["Goals:"]
            for g in goals:
                target = float(g.target_amount)
                current = float(g.current_amount)
                remaining = target - current
                suggested = None
                if g.deadline:
                    delta = (g.deadline - today).days
                    days = max(0, delta)
                    if days > 0 and remaining > 0:
                        suggested = round(remaining / days * 30, 2)
                line = f"  - {g.name}: {current:.2f} / {target:.2f} ({g.status})"
                if suggested:
                    line += f" [need ₹{suggested:.2f}/month to meet deadline]"
                lines.append(line)
            return "\n".join(lines)

        async def _bills():
            r = await db.execute(select(Bill).where(Bill.user_id == user_id, Bill.is_paid == False).order_by(Bill.due_date).limit(10))
            bills = r.scalars().all()
            if not bills:
                return "No upcoming bills."
            return "\n".join(f"  - {b.name}: {float(b.amount):.2f} due {b.due_date}" for b in bills)

        cm_income, cm_expense, lm_income, lm_expense, accts, budgets, goals, bills, cm_cats, lm_cats = await asyncio.gather(
            _income_period(month_start, month_end), _expense_period(month_start, month_end),
            _income_period(last_month_start, last_month_end), _expense_period(last_month_start, last_month_end),
            _accounts(), _budgets(), _goals(), _bills(),
            _top_categories(month_start, month_end), _top_categories(last_month_start, last_month_end),
        )

        parts = [
            f"User: {name}",
            accts,
            f"This month ({month_start} to {today}): income ₹{cm_income:.2f}, expenses ₹{cm_expense:.2f}",
            f"Last month ({last_month_start} to {last_month_end}): income ₹{lm_income:.2f}, expenses ₹{lm_expense:.2f}",
            f"Top categories this month: {cm_cats}",
            f"Top categories last month: {lm_cats}",
            budgets,
            goals,
            bills,
        ]
        return {"financial_context": "\n".join(parts)}
    return context_builder
