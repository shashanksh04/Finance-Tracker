from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.alert import Alert, AlertPreference
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.bill import Bill
from app.models.goal import Goal
from app.schemas.alert import AlertCreate
from datetime import date, timedelta
from app.core.currency import CURRENCY_SYMBOLS


class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_alert(self, user_id: str, data: AlertCreate) -> Alert:
        alert = Alert(user_id=user_id, **data.model_dump())
        self.db.add(alert)
        await self.db.flush()
        return alert

    async def get_alerts(self, user_id: str, unread_only: bool = False, limit: int = 50) -> list[Alert]:
        query = select(Alert).where(Alert.user_id == user_id, Alert.is_dismissed == False, Alert.deleted_at.is_(None))
        if unread_only:
            query = query.where(Alert.is_read == False)
        query = query.order_by(Alert.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def mark_read(self, user_id: str, alert_id: str) -> Alert:
        result = await self.db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.user_id == user_id, Alert.deleted_at.is_(None))
        )
        alert = result.scalar_one_or_none()
        if alert:
            alert.is_read = True
            await self.db.flush()
        return alert

    async def dismiss(self, user_id: str, alert_id: str) -> Alert:
        result = await self.db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.user_id == user_id, Alert.deleted_at.is_(None))
        )
        alert = result.scalar_one_or_none()
        if alert:
            alert.is_dismissed = True
            await self.db.flush()
        return alert

    async def get_preferences(self, user_id: str) -> list[AlertPreference]:
        result = await self.db.execute(
            select(AlertPreference).where(AlertPreference.user_id == user_id, AlertPreference.deleted_at.is_(None))
        )
        prefs = list(result.scalars().all())
        if not prefs:
            defaults = []
            for atype in ["spending_limit", "budget_exceeded", "goal_milestone", "unusual_spending", "bill_due", "account_low", "recurring_failed", "monthly_summary"]:
                pref = AlertPreference(user_id=user_id, alert_type=atype)
                self.db.add(pref)
                defaults.append(pref)
            await self.db.flush()
            return defaults
        return prefs

    async def update_preference(self, user_id: str, alert_type: str, enabled: bool, threshold: float = None) -> AlertPreference:
        result = await self.db.execute(
            select(AlertPreference).where(AlertPreference.user_id == user_id, AlertPreference.alert_type == alert_type, AlertPreference.deleted_at.is_(None))
        )
        pref = result.scalar_one_or_none()
        if not pref:
            pref = AlertPreference(user_id=user_id, alert_type=alert_type)
            self.db.add(pref)
        pref.enabled = enabled
        if threshold is not None:
            pref.threshold = threshold
        await self.db.flush()
        return pref

    async def _already_active(self, user_id: str, atype: str, category_id: str = None, title: str = None) -> bool:
        q = select(Alert.id).where(
            Alert.user_id == user_id,
            Alert.type == atype,
            Alert.is_dismissed == False,
            Alert.deleted_at.is_(None),
        )
        if category_id:
            q = q.where(Alert.category_id == category_id)
        elif title:
            q = q.where(Alert.title == title)
        else:
            q = q.where(Alert.category_id.is_(None))
        result = await self.db.execute(q)
        return result.scalar_one_or_none() is not None

    async def generate_alerts(self, user_id: str) -> list[Alert]:
        alerts = []
        today = date.today()

        # Budget exceeded alerts
        budget_result = await self.db.execute(
            select(Budget).where(Budget.user_id == user_id, Budget.is_active == True, Budget.deleted_at.is_(None))
        )
        budgets = list(budget_result.scalars().all())
        for budget in budgets:
            spent_result = await self.db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0))
                .where(Transaction.user_id == user_id, Transaction.type == "expense", Transaction.category_id == budget.category_id, Transaction.deleted_at.is_(None))
            )
            spent = float(spent_result.scalar() or 0)
            if float(budget.amount) > 0 and spent / float(budget.amount) > 0.9:
                if not await self._already_active(user_id, "budget_exceeded", category_id=budget.category_id):
                    alerts.append(Alert(
                        user_id=user_id, type="budget_exceeded",
                        title="Budget Nearly Exceeded",
                        message=f"You've used {round(spent/float(budget.amount)*100)}% of your budget",
                        severity="warning", category_id=budget.category_id, related_amount=spent
                    ))

        from app.models.user import User
        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        currency = (user.settings or {}).get("currency", "USD") if user else "USD"
        sym = CURRENCY_SYMBOLS.get(currency, "$")

        # Bill due alerts
        bill_result = await self.db.execute(
            select(Bill).where(Bill.user_id == user_id, Bill.is_paid == False, Bill.deleted_at.is_(None), Bill.due_date <= today + timedelta(days=7))
        )
        for bill in bill_result.scalars().all():
            severity = "critical" if bill.due_date <= today else "warning"
            title = f"Bill Due: {bill.name}"
            if not await self._already_active(user_id, "bill_due", title=title):
                alerts.append(Alert(
                    user_id=user_id, type="bill_due",
                    title=title,
                    message=f"{bill.name} of {sym}{float(bill.amount):.2f} is due on {bill.due_date}",
                    severity=severity, related_amount=float(bill.amount)
                ))

        # Goal milestone alerts
        goal_result = await self.db.execute(
            select(Goal).where(Goal.user_id == user_id, Goal.status == "active", Goal.deleted_at.is_(None))
        )
        for goal in goal_result.scalars().all():
            if float(goal.target_amount) > 0:
                pct = float(goal.current_amount) / float(goal.target_amount) * 100
                if pct >= 100:
                    title = f"Goal Completed: {goal.name}"
                    if not await self._already_active(user_id, "goal_milestone", title=title):
                        alerts.append(Alert(
                            user_id=user_id, type="goal_milestone",
                            title=title,
                            message=f"You've reached your goal: {goal.name}",
                            severity="info"
                        ))

        # Add to DB
        for alert in alerts:
            self.db.add(alert)
        await self.db.flush()
        return alerts
