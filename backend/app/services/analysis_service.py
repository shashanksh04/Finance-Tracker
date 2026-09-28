from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, Integer
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account
from app.models.bill import Bill
from app.services.recurring_service import RecurringService
from datetime import date, datetime, timedelta, timezone
from collections import defaultdict
from typing import Optional, List, Dict, Any
import math
from app.core.currency import CURRENCY_SYMBOLS

# Accounts whose balance is spendable cash. Credit/loan/investment balances are
# reported as liabilities rather than counted toward projected liquidity.
LIQUID_ACCOUNT_TYPES = ("checking", "savings", "cash")


class AnalysisService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _balance_as_of(account, transactions: list, as_of: date) -> float:
        """Balance of `account` as it stood on `as_of`.

        Account.balance is maintained on write and therefore already includes
        every future-dated transaction. To recover the true balance at a past
        (or current) point in time we reverse everything dated after `as_of`.
        """
        bal = float(account.balance or 0)
        for t in transactions:
            if t.date.date() > as_of:
                amt = float(t.amount or 0)
                bal -= amt if t.type == "income" else -amt
        return bal

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
        query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(and_(*where_clauses), Transaction.deleted_at.is_(None))
        result = await self.db.execute(query)
        return float(result.scalar() or 0)

    async def _count_with_filter(self, where_clauses) -> int:
        query = select(func.count(Transaction.id)).where(and_(*where_clauses), Transaction.deleted_at.is_(None))
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _category_breakdown(self, user_id: str, start: date, end: date, account_id: str = None) -> list:
        where = [Transaction.user_id == user_id, Transaction.date >= start, Transaction.date < end, Transaction.type == "expense", Transaction.deleted_at.is_(None)]
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
        import asyncio
        intervals = []
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
            intervals.append((current, next_d, label))
            current = next_d

        async def _fetch_interval(cur: date, nxt: date):
            inc = await self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= cur, Transaction.date < nxt, Transaction.type == "income"])
            exp = await self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= cur, Transaction.date < nxt, Transaction.type == "expense"])
            cnt = await self._count_with_filter([Transaction.user_id == user_id, Transaction.date >= cur, Transaction.date < nxt])
            return cur, inc, exp, cnt

        results = await asyncio.gather(*[_fetch_interval(s, e) for s, e, _ in intervals])
        lookup = {r[0]: r for r in results}
        trends = []
        for cur, nxt, label in intervals:
            _, inc, exp, cnt = lookup[cur]
            trends.append({
                "period_label": label,
                "income": round(float(inc), 2),
                "expenses": round(float(exp), 2),
                "net": round(float(inc) - float(exp), 2),
                "transaction_count": cnt,
            })
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
            Transaction.deleted_at.is_(None),
        ).group_by(Transaction.merchant).order_by(func.sum(Transaction.amount).desc()).limit(10)
        result = await self.db.execute(query)
        return [{"merchant": r.merchant, "total": round(float(r.total), 2), "count": r.count} for r in result.all()]

    def _generate_insights(self, income: float, expenses: float, net: float, breakdown: list, currency: str = "USD") -> list:
        insights = []
        sym = CURRENCY_SYMBOLS.get(currency, "$")
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
        import asyncio
        today = date.today()
        month_start = today.replace(day=1)
        if today.month == 12:
            month_end = today.replace(year=today.year + 1, month=1, day=1)
        else:
            month_end = today.replace(month=today.month + 1, day=1)

        monthly_income_coro = self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "income"])
        monthly_expenses_coro = self._sum_with_filter([Transaction.user_id == user_id, Transaction.date >= month_start, Transaction.date < month_end, Transaction.type == "expense"])
        cat_breakdown_coro = self._category_breakdown(user_id, month_start, month_end, None)
        from app.models.account import Account
        from app.services.account_service import AccountService
        acct_service = AccountService(self.db)

        monthly_income, monthly_expenses, cat_breakdown, accounts_raw = await asyncio.gather(
            monthly_income_coro, monthly_expenses_coro, cat_breakdown_coro, acct_service.get_all(user_id)
        )
        total_balance = sum(float(a.balance) for a in (accounts_raw["items"] if isinstance(accounts_raw, dict) else accounts_raw))

        from app.models.budget import Budget
        from sqlalchemy.orm import joinedload
        budget_result = await self.db.execute(
            select(Budget).options(joinedload(Budget.category)).where(Budget.user_id == user_id, Budget.is_active == True, Budget.deleted_at.is_(None))
        )
        budgets = list(budget_result.unique().scalars().all())
        budget_health = []
        if budgets:
            cat_ids = [b.category_id for b in budgets if b.category_id]
            spent_map = {}
            if cat_ids:
                spent_rows = await self.db.execute(
                    select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0).label("total"))
                    .where(
                        Transaction.user_id == user_id,
                        Transaction.date >= month_start,
                        Transaction.date < month_end,
                        Transaction.type == "expense",
                        Transaction.deleted_at.is_(None),
                        Transaction.category_id.in_(cat_ids),
                    )
                    .group_by(Transaction.category_id)
                )
                spent_map = {row.category_id: float(row.total) for row in spent_rows.all()}
            overall_spent = 0.0
            if any(b.category_id is None for b in budgets):
                overall_result = await self.db.execute(
                    select(func.coalesce(func.sum(Transaction.amount), 0))
                    .where(
                        Transaction.user_id == user_id,
                        Transaction.date >= month_start,
                        Transaction.date < month_end,
                        Transaction.type == "expense",
                        Transaction.deleted_at.is_(None),
                    )
                )
                overall_spent = float(overall_result.scalar() or 0)
            for b in budgets:
                spent = spent_map.get(b.category_id, 0) if b.category_id else overall_spent
                pct = round(float(spent) / float(b.amount) * 100, 1) if float(b.amount) > 0 else 0
                budget_health.append({"category": b.category.name if b.category else "Overall", "budgeted": float(b.amount), "spent": round(spent, 2), "percentage": pct})

        txn_result = await self.db.execute(
            select(Transaction).where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None)).order_by(Transaction.date.desc()).limit(10)
        )
        recent = [{"id": t.id, "description": t.description, "amount": float(t.amount), "type": t.type, "date": t.date.isoformat()} for t in txn_result.scalars().all()]

        from app.models.bill import Bill
        bill_result = await self.db.execute(
            select(Bill).where(Bill.user_id == user_id, Bill.is_paid == False, Bill.deleted_at.is_(None)).order_by(Bill.due_date).limit(10)
        )
        upcoming = [{"id": b.id, "name": b.name, "amount": float(b.amount), "due_date": b.due_date.isoformat()} for b in bill_result.scalars().all()]

        from app.models.alert import Alert
        alert_result = await self.db.execute(
            select(Alert).where(Alert.user_id == user_id, Alert.is_dismissed == False, Alert.is_read == False, Alert.deleted_at.is_(None)).order_by(Alert.created_at.desc()).limit(10)
        )
        alerts_list = [{"id": a.id, "type": a.type, "title": a.title, "severity": a.severity, "message": a.message, "created_at": a.created_at.isoformat()} for a in alert_result.scalars().all()]

        from app.models.goal import Goal
        goal_result = await self.db.execute(select(Goal).where(Goal.user_id == user_id, Goal.status == "active", Goal.deleted_at.is_(None)))
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

    async def get_net_worth_trend(self, user_id: str, months: int = 12) -> dict:
        today = date.today()
        ends = []
        y, m = today.year, today.month
        for _ in range(max(1, months)):
            nxt = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
            ends.append(nxt - timedelta(days=1))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        ends.sort()

        acct_result = await self.db.execute(
            select(Account).where(Account.user_id == user_id, Account.deleted_at.is_(None))
        )
        accounts = list(acct_result.scalars().all())
        txn_result = await self.db.execute(
            select(Transaction).where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
        )
        by_acct = defaultdict(list)
        for t in txn_result.scalars().all():
            by_acct[t.account_id].append(t)

        series = []
        for end in ends:
            assets = 0.0
            liabilities = 0.0
            for a in accounts:
                b = self._balance_as_of(a, by_acct.get(a.id, []), end)
                if a.type == "credit":
                    liabilities += b
                else:
                    assets += b
            series.append({
                "month": end.strftime("%Y-%m"),
                "label": end.strftime("%b %Y"),
                "net_worth": round(assets - liabilities, 2),
                "assets": round(assets, 2),
                "liabilities": round(liabilities, 2),
            })
        return {"months": months, "series": series}

    async def get_calendar(self, user_id: str, year: int, month: int) -> dict:
        import calendar as cal
        from app.models.bill import Bill

        start = date(year, month, 1)
        end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

        result = await self.db.execute(
            select(
                func.cast(func.extract('day', Transaction.date), Integer).label('day'),
                Transaction.type,
                func.coalesce(func.sum(Transaction.amount), 0).label('total'),
                func.count(Transaction.id).label('cnt'),
            ).where(
                Transaction.user_id == user_id,
                Transaction.date >= start, Transaction.date < end,
                Transaction.deleted_at.is_(None),
            ).group_by(func.cast(func.extract('day', Transaction.date), Integer), Transaction.type)
        )
        days = {}
        for r in result.all():
            d = int(r.day)
            entry = days.setdefault(d, {"day": d, "income": 0.0, "expense": 0.0, "count": 0})
            if r.type == "income":
                entry["income"] += float(r.total)
            else:
                entry["expense"] += float(r.total)
            entry["count"] += int(r.cnt)

        bill_result = await self.db.execute(
            select(Bill).where(Bill.user_id == user_id, Bill.deleted_at.is_(None), Bill.due_date >= start, Bill.due_date < end)
        )
        bills = [
            {"id": b.id, "name": b.name, "amount": float(b.amount), "due_date": b.due_date.isoformat(), "is_paid": b.is_paid}
            for b in bill_result.scalars().all()
        ]

        num_days = cal.monthrange(year, month)[1]
        day_list = [days.get(d, {"day": d, "income": 0.0, "expense": 0.0, "count": 0}) for d in range(1, num_days + 1)]
        return {"year": year, "month": month, "days": day_list, "bills": bills}

    async def get_cashflow_projection(
        self,
        user_id: str,
        days: int = 90,
        account_id: str = None,
        currency: str = "USD",
    ) -> dict:
        """Project spendable cash forward over `days` days.

        Three sources of known future movement are combined:

        1. Recurring transactions, expanded from ``next_date``. That field is
           always the next *un-materialised* occurrence, so expanding it cannot
           double-count the transactions the Celery job has already written
           (those are dated today and stay in the opening balance).
        2. Unpaid bills due inside the window, minus any bill already covered
           by a future-dated transaction or by a recurring item.
        3. Future-dated transactions that are neither recurring nor bill
           linked -- i.e. things the user has scheduled by hand.

        Balances exclude future-dated transactions via ``_balance_as_of``,
        because ``Account.balance`` already includes them.
        """
        days = max(7, min(int(days or 90), 365))
        today = date.today()
        horizon_end = today + timedelta(days=days)

        acct_stmt = select(Account).where(Account.user_id == user_id, Account.deleted_at.is_(None))
        if account_id:
            acct_stmt = acct_stmt.where(Account.id == account_id)
        accounts = list((await self.db.execute(acct_stmt)).scalars().all())

        txn_result = await self.db.execute(
            select(Transaction).where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
        )
        transactions = list(txn_result.scalars().all())
        by_acct = defaultdict(list)
        for t in transactions:
            by_acct[t.account_id].append(t)

        opening_balance = 0.0
        liabilities = 0.0
        for a in accounts:
            bal = self._balance_as_of(a, by_acct.get(a.id, []), today)
            if a.type in LIQUID_ACCOUNT_TYPES:
                opening_balance += bal
            elif a.type in ("credit", "loan"):
                liabilities += abs(bal)

        # (date, signed amount, label, kind)
        events: List[tuple] = []

        # 1. Recurring. next_date is the next occurrence not yet written as a
        #    transaction, so there is no overlap with materialised rows.
        from app.models.recurring import RecurringTransaction

        rec_result = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user_id,
                RecurringTransaction.deleted_at.is_(None),
                RecurringTransaction.is_active.is_(True),
                RecurringTransaction.next_date <= horizon_end,
            )
        )
        rec_service = RecurringService(self.db)
        for item in rec_result.scalars().all():
            if item.end_date and item.next_date < today:
                continue
            occurrence = item.next_date
            guard = 0
            while occurrence <= horizon_end and guard < 400:
                if not (item.end_date and occurrence > item.end_date):
                    amt = float(item.amount or 0)
                    signed = amt if item.type == "income" else -amt
                    events.append((occurrence, signed, item.description or "Recurring", "recurring"))
                occurrence = rec_service.calculate_next_date(
                    occurrence, item.frequency, item.interval_value or 1
                )
                guard += 1

        # Bills already represented by a future-dated transaction.
        bills_covered = {t.bill_id for t in transactions if t.bill_id and t.date.date() > today}

        # 2. Unpaid bills in the window.
        bill_result = await self.db.execute(
            select(Bill).where(
                Bill.user_id == user_id,
                Bill.deleted_at.is_(None),
                Bill.is_paid.is_(False),
                Bill.due_date >= today,
                Bill.due_date <= horizon_end,
            )
        )
        for b in bill_result.scalars().all():
            if b.recurring_id:
                continue  # already covered by the recurring expansion
            if b.id in bills_covered:
                continue  # a scheduled transaction already pays this bill
            events.append((b.due_date, -float(b.amount or 0), b.name, "bill"))

        # 3. Hand-scheduled future transactions. Recurring-linked rows are
        #    excluded because item 1 already projects them.
        for t in transactions:
            tdate = t.date.date()
            if tdate <= today or tdate > horizon_end:
                continue
            if t.recurring_id or t.bill_id:
                continue
            amt = float(t.amount or 0)
            events.append((tdate, amt if t.type == "income" else -amt, t.description or t.merchant or "Scheduled", "scheduled"))

        # Bucket into daily or weekly steps.
        by_day = defaultdict(float)
        for d, signed, _label, _kind in events:
            by_day[d] += signed

        buckets, running, lowest = self._build_buckets(by_day, opening_balance, today, days, horizon_end)

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "start_date": today.isoformat(),
            "end_date": horizon_end.isoformat(),
            "days": days,
            "granularity": "daily" if days <= 31 else "weekly",
            "currency": currency,
            "opening_balance": round(opening_balance, 2),
            "liabilities": round(liabilities, 2),
            "projected_closing_balance": round(running, 2),
            "total_inflow": round(sum(b["inflow"] for b in buckets), 2),
            "total_outflow": round(sum(b["outflow"] for b in buckets), 2),
            "lowest_point": lowest,
            "is_overdrawn": lowest["balance"] < 0,
            "buckets": buckets,
        }

    @staticmethod
    def _build_buckets(
        by_day: dict,
        opening_balance: float,
        today: date,
        days: int,
        horizon_end: date,
    ):
        """Fold per-day net movement into a running balance.

        Windows of 31 days or fewer are bucketed daily; longer ones weekly, so
        a 12-month projection does not return 365 points.
        """
        granularity = "daily" if days <= 31 else "weekly"
        step = 1 if days <= 31 else 7

        buckets = []
        running = opening_balance
        lowest = {"balance": round(opening_balance, 2), "label": None, "in_days": 0}
        cursor = today
        while cursor <= horizon_end:
            b_end = min(cursor + timedelta(days=step - 1), horizon_end)
            inflow = 0.0
            outflow = 0.0
            d = cursor
            while d <= b_end:
                net = by_day.get(d, 0.0)
                if net > 0:
                    inflow += net
                else:
                    outflow += -net
                d += timedelta(days=1)
            running += inflow - outflow
            label = (
                cursor.isoformat()
                if granularity == "daily"
                else f"{cursor.strftime('%b %d')} - {b_end.strftime('%b %d')}"
            )
            buckets.append({
                "label": label,
                "start_date": cursor.isoformat(),
                "end_date": b_end.isoformat(),
                "inflow": round(inflow, 2),
                "outflow": round(outflow, 2),
                "net": round(inflow - outflow, 2),
                "closing_balance": round(running, 2),
            })
            if running < lowest["balance"]:
                lowest = {
                    "balance": round(running, 2),
                    "label": label,
                    "in_days": (b_end - today).days,
                }
            cursor = b_end + timedelta(days=1)

        return buckets, round(running, 2), lowest
