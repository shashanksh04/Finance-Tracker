from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.transaction import Transaction
from app.models.category import Category
from datetime import date, timedelta
from typing import Optional
import math


class AnalysisService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_period_analysis(self, user_id: str, period: str, year: int, month: int = None, quarter: int = None, account_id: str = None, category_id: str = None, currency: str = "USD") -> dict:
        if period == "monthly" and month:
            start = date(year, month, 1)
            if month == 12:
                end = date(year + 1, 1, 1)
            else:
                end = date(year, month + 1, 1)
        elif period == "quarterly" and quarter:
            start = date(year, quarter * 3 - 2, 1)
            if quarter == 4:
                end = date(year + 1, 1, 1)
            else:
                end = date(year, quarter * 3 + 1, 1)
        elif period == "yearly":
            start = date(year, 1, 1)
            end = date(year + 1, 1, 1)
        else:
            now = date.today()
            start = now.replace(day=1)
            if now.month == 12:
                end = now.replace(year=now.year + 1, month=1, day=1)
            else:
                end = now.replace(month=now.month + 1, day=1)

        return await self._analyze_period(user_id, start, end, account_id, category_id, currency)

    async def _analyze_period(self, user_id: str, start: date, end: date, account_id: str = None, category_id: str = None, currency: str = "USD") -> dict:
        base_where = [Transaction.user_id == user_id, Transaction.date >= start, Transaction.date < end]
        if account_id:
            base_where.append(Transaction.account_id == account_id)
        if category_id:
            base_where.append(Transaction.category_id == category_id)

        income = await self._sum_with_filter(base_where + [Transaction.type == "income"])
        expenses = await self._sum_with_filter(base_where + [Transaction.type == "expense"])
        count = await self._count_with_filter(base_where)

        cat_breakdown = await self._category_breakdown(user_id, start, end, account_id)
        trends = await self._trends(user_id, start, end, account_id)
        merchants = await self._top_merchants(user_id, start, end)

        net = float(income) - float(expenses)
        savings_rate = round((net / float(income) * 100), 1) if float(income) > 0 else 0

        return {
            "period": "custom",
            "label": f"{start} - {end}",
            "total_income": round(float(income), 2),
            "total_expenses": round(float(expenses), 2),
            "net_savings": round(net, 2),
            "savings_rate": savings_rate,
            "transaction_count": count,
            "category_breakdown": cat_breakdown,
            "trends": trends,
            "top_merchants": merchants[:10],
            "insights": self._generate_insights(float(income), float(expenses), net, cat_breakdown, currency),
        }

    async def _sum_with_filter(self, where_clauses) -> float:
        query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(and_(*where_clauses))
        result = await self.db.execute(query)
        return float(result.scalar() or 0)

    async def _count_with_filter(self, where_clauses) -> int:
        query = select(func.count(Transaction.id)).where(and_(*where_clauses))
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _category_breakdown(self, user_id: str, start: date, end: date, account_id: str = None) -> list:
        where = [Transaction.user_id == user_id, Transaction.date >= start, Transaction.date < end, Transaction.type == "expense"]
        if account_id:
            where.append(Transaction.account_id == account_id)
        query = select(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0).label("amount"),
            func.count(Transaction.id).label("count"),
        ).where(and_(*where)).group_by(Transaction.category_id)
        result = await self.db.execute(query)
        rows = result.all()
        total = sum(float(r.amount) for r in rows) if rows else 0
        cat_ids = [r.category_id for r in rows if r.category_id]
        cat_map = {}
        if cat_ids:
            cat_result = await self.db.execute(
                select(Category).where(Category.id.in_(cat_ids))
            )
            for cat in cat_result.scalars().all():
                cat_map[cat.id] = cat
        breakdown = []
        for r in rows:
            cat_name = "Uncategorized"
            cat_icon = None
            cat_color = None
            if r.category_id and r.category_id in cat_map:
                cat = cat_map[r.category_id]
                cat_name = cat.name
                cat_icon = cat.icon
                cat_color = cat.color
            breakdown.append({
                "category_id": r.category_id,
                "category_name": cat_name,
                "category_icon": cat_icon,
                "category_color": cat_color,
                "amount": round(float(r.amount), 2),
                "percentage": round(float(r.amount) / total * 100, 1) if total > 0 else 0,
                "transaction_count": r.count,
            })
        return sorted(breakdown, key=lambda x: x["amount"], reverse=True)

    async def _trends(self, user_id: str, start: date, end: date, account_id: str = None) -> list:
        trends = []
        current = start
        while current < end:
            if (end - start).days <= 35:
                next_d = current + timedelta(days=7)
                label = f"Week of {current}"
            elif (end - start).days <= 185:
                next_d = current + timedelta(days=30)
                label = current.strftime("%b %Y")
            else:
                next_d = current + timedelta(days=90)
                label = f"Q{(current.month - 1) // 3 + 1} {current.year}"
            if next_d > end:
                next_d = end
            inc = await self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= current, Transaction.date < next_d, Transaction.type == "income"])
            exp = await self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= current, Transaction.date < next_d, Transaction.type == "expense"])
            cnt = await self._count_with_filter([Transaction.user_id == user_id, Transaction.date >= current, Transaction.date < next_d])
            trends.append({
                "period_label": label,
                "income": round(float(inc), 2),
                "expenses": round(float(exp), 2),
                "net": round(float(inc) - float(exp), 2),
                "transaction_count": cnt,
            })
            current = next_d
        return trends

    async def _top_merchants(self, user_id: str, start: date, end: date) -> list:
        query = select(
            Transaction.merchant,
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
            func.count(Transaction.id).label("count"),
        ).where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date < end,
            Transaction.merchant.isnot(None),
            Transaction.merchant != "",
        ).group_by(Transaction.merchant).order_by(func.sum(Transaction.amount).desc()).limit(10)
        result = await self.db.execute(query)
        return [{"merchant": r.merchant, "total": round(float(r.total), 2), "count": r.count} for r in result.all()]

    def _generate_insights(self, income: float, expenses: float, net: float, breakdown: list, currency: str = "USD") -> list:
        insights = []
        sym = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥", "CAD": "C$", "AUD": "A$", "SGD": "S$", "CHF": "Fr", "CNY": "¥"}.get(currency, "$")
        if net > 0:
            insights.append(f"You saved {sym}{net:.2f} this period ({round(net/income*100,1)}% savings rate)")
        else:
            insights.append("Your expenses exceeded your income this period")
        if breakdown:
            top_cat = breakdown[0]
            insights.append(f"Top spending category: {top_cat['category_name']} ({sym}{top_cat['amount']:.2f})")
            if len(breakdown) > 1:
                insights.append(f"Top 3 categories account for {round(sum(b['percentage'] for b in breakdown[:3]),1)}% of spending")
        return insights

    async def get_dashboard_summary(self, user_id: str) -> dict:
        today = date.today()
        month_start = today.replace(day=1)
        if today.month == 12:
            month_end = today.replace(year=today.year + 1, month=1, day=1)
        else:
            month_end = today.replace(month=today.month + 1, day=1)

        monthly_income = await self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "income"])
        monthly_expenses = await self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "expense"])

        from app.models.account import Account
        from app.services.account_service import AccountService
        acct_service = AccountService(self.db)
        accounts = await acct_service.get_all(user_id)
        total_balance = sum(float(a.balance) for a in accounts)

        cat_breakdown = await self._category_breakdown(user_id, month_start, month_end, None)

        from app.models.budget import Budget
        from sqlalchemy.orm import joinedload
        budget_result = await self.db.execute(
            select(Budget).options(joinedload(Budget.category)).where(Budget.user_id == user_id, Budget.is_active == True)
        )
        budgets = list(budget_result.unique().scalars().all())
        budget_health = []
        if budgets:
            cat_ids = [b.category_id for b in budgets if b.category_id]
            if cat_ids:
                spent_rows = await self.db.execute(
                    select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0).label("total"))
                    .where(
                        Transaction.user_id == user_id,
                        Transaction.date >= month_start,
                        Transaction.date < month_end,
                        Transaction.type == "expense",
                        Transaction.category_id.in_(cat_ids),
                    )
                    .group_by(Transaction.category_id)
                )
                spent_map = {row.category_id: float(row.total) for row in spent_rows.all()}
            else:
                spent_map = {}
            for b in budgets:
                spent = spent_map.get(b.category_id, 0)
                pct = round(float(spent) / float(b.amount) * 100, 1) if float(b.amount) > 0 else 0
                budget_health.append({"category": b.category.name if b.category else "Overall", "budgeted": float(b.amount), "spent": spent, "percentage": pct})

        txn_result = await self.db.execute(
            select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.date.desc()).limit(10)
        )
        recent = [{"id": t.id, "description": t.description, "amount": float(t.amount), "type": t.type, "date": t.date.isoformat()} for t in txn_result.scalars().all()]

        from app.models.bill import Bill
        bill_result = await self.db.execute(
            select(Bill).where(Bill.user_id == user_id, Bill.is_paid == False).order_by(Bill.due_date).limit(10)
        )
        upcoming = [{"id": b.id, "name": b.name, "amount": float(b.amount), "due_date": b.due_date.isoformat()} for b in bill_result.scalars().all()]

        from app.models.alert import Alert
        alert_result = await self.db.execute(
            select(Alert).where(Alert.user_id == user_id, Alert.is_dismissed == False, Alert.is_read == False).order_by(Alert.created_at.desc()).limit(10)
        )
        alerts_list = [{"id": a.id, "type": a.type, "title": a.title, "severity": a.severity, "message": a.message, "created_at": a.created_at.isoformat()} for a in alert_result.scalars().all()]

        from app.models.goal import Goal
        goal_result = await self.db.execute(select(Goal).where(Goal.user_id == user_id, Goal.status == "active"))
        goals = [{"id": g.id, "name": g.name, "progress": round(float(g.current_amount)/float(g.target_amount)*100, 1) if float(g.target_amount) > 0 else 0} for g in goal_result.scalars().all()]

        return {
            "total_balance": round(total_balance, 2),
            "monthly_income": round(float(monthly_income), 2),
            "monthly_expenses": round(float(monthly_expenses), 2),
            "net_worth_change": round(float(monthly_income) - float(monthly_expenses), 2),
            "budget_health": budget_health,
            "recent_transactions": recent,
            "upcoming_bills": upcoming,
            "alerts": alerts_list,
            "goal_progress": goals,
            "spending_by_category": cat_breakdown,
        }
