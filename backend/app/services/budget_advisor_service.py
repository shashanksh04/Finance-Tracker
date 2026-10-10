import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.category import Category
from typing import List, Dict, Any
from datetime import date, timedelta
from app.core.config import settings
import httpx

# Needs ("50") vs wants ("30") heuristic for the 50/30/20 allocation.
_NEEDS_KEYWORDS = (
    "housing", "rent", "mortgage", "utilities", "groceries", "grocery",
    "food", "medical", "health", "insurance", "transport", "transit",
    "commute", "gas", "car", "phone", "water", "electric", "internet",
    "childcare", "education", "loan",
)
_WANTS_KEYWORDS = (
    "dining", "restaurant", "entertainment", "shopping", "travel", "fun",
    "hobby", "subscription", "streaming", "gym", "fitness", "clothing",
    "coffee", "bar", "nightlife", "confection",
)


def _classify(name: str) -> str:
    n = (name or "").lower()
    for kw in _NEEDS_KEYWORDS:
        if kw in n:
            return "needs"
    for kw in _WANTS_KEYWORDS:
        if kw in n:
            return "wants"
    return "savings"


class BudgetAdvisorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_recommendations(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Analyze spending habits and return actionable budget recommendations.

        The logic is deterministic-first: it always produces sensible advice from
        the transaction history even when the LLM is unavailable. When Ollama is
        reachable it additionally polishes a headline from the structured cards.
        This guarantees the feature is useful out of the box, for brand-new users
        (no budgets) and existing ones alike.
        """
        # 1. Trailing-30-day window. Transaction.date is a DATE column, so use a
        #    date (not an aware datetime) to avoid cross-type comparison errors.
        today = date.today()
        thirty_days_ago = today - timedelta(days=30)

        # 2. Spending by category + total income.
        spend_result = await self.db.execute(
            select(Category.name, func.coalesce(func.sum(Transaction.amount), 0))
            .join(Transaction, Transaction.category_id == Category.id)
            .where(
                Transaction.user_id == user_id,
                Transaction.type == "expense",
                Transaction.date >= thirty_days_ago,
                Transaction.deleted_at.is_(None),
                Category.deleted_at.is_(None),
            )
            .group_by(Category.name)
            .order_by(func.sum(Transaction.amount).desc())
        )
        spending = [
            {"category": row[0], "spent": round(float(row[1]), 2)}
            for row in spend_result.all()
        ]
        total_spent = round(sum(s["spent"] for s in spending), 2)

        income_result = await self.db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.type == "income",
                Transaction.date >= thirty_days_ago,
                Transaction.deleted_at.is_(None),
            )
        )
        total_income = round(float(income_result.scalar() or 0), 2)

        # 3. Existing active budgets, with category names resolved in one batch.
        budget_rows = list((await self.db.execute(
            select(Budget.amount, Budget.category_id).where(
                Budget.user_id == user_id,
                Budget.is_active.is_(True),
                Budget.deleted_at.is_(None),
            )
        )).all())
        spent_by_cat = {s["category"]: s["spent"] for s in spending}
        cat_name_by_id: Dict[str, str] = {}
        if budget_rows:
            cat_ids = [c for _, c in budget_rows if c]
            if cat_ids:
                cats = list((await self.db.execute(
                    select(Category).where(Category.id.in_(cat_ids))
                )).scalars().all())
                cat_name_by_id = {c.id: c.name for c in cats}

        recommendations: List[Dict[str, Any]] = []

        if budget_rows:
            recommendations = self._recommend_from_budgets(budget_rows, spent_by_cat, cat_name_by_id)
        elif total_spent > 0:
            recommendations = self._suggest_allocations(spending, total_income, total_spent)
        else:
            recommendations.append({
                "type": "getting_started",
                "title": "Get personalized budget advice",
                "message": (
                    "Add a few transactions or record your monthly income and we'll "
                    "suggest a 50/30/20 budget split automatically."
                ),
                "severity": "info",
            })

        # 4. Optional LLM polish of a headline (best-effort; never blocks the result).
        polished = await self._polish(recommendations, spending, total_income)
        return polished or recommendations

    # ------------------------------------------------------------------ engine

    def _suggest_allocations(self, spending: list, total_income: float, total_spent: float) -> List[Dict[str, Any]]:
        """Deterministic 50/30/20 allocation suggestion for users with no budgets."""
        recs: List[Dict[str, Any]] = []

        # Group categories into needs / wants / savings.
        buckets = {"needs": 0.0, "wants": 0.0, "savings": 0.0}
        for s in spending:
            buckets[_classify(s["category"])] += s["spent"]

        if total_income > 0:
            needs_target = round(total_income * 0.5, 2)
            wants_target = round(total_income * 0.3, 2)
            savings_target = round(total_income * 0.2, 2)
            total_savings = 0.0

            recs.append({
                "type": "allocation",
                "title": "Try the 50/30/20 method",
                "message": (
                    f"Aim to spend about {needs_target:.0f} on needs, "
                    f"{wants_target:.0f} on wants, and save {savings_target:.0f} each month."
                ),
                "severity": "info",
                "current": {"needs": round(buckets["needs"], 2), "wants": round(buckets["wants"], 2)},
                "suggested": {"needs": needs_target, "wants": wants_target, "savings": savings_target},
            })

            # Wants over its target -> the biggest lever.
            over = buckets["wants"] - wants_target
            if over > 0:
                cut = round(over * 0.2, 2)
                total_savings += cut
                recs.append({
                    "type": "saving",
                    "title": "Trim discretionary spending",
                    "message": (
                        f"You're spending {buckets['wants']:.0f} on wants vs a "
                        f"{wants_target:.0f} target. Cutting just 20% saves ~{cut:.0f}/month."
                    ),
                    "severity": "warning",
                    "potential_savings": cut,
                })

            # Per-category caps for the top 3 spenders.
            for s in spending[:3]:
                cap = round(s["spent"] * 0.8)  # suggest a 20% cushion
                save = round(s["spent"] - cap, 2)
                if save >= 5:  # only surface meaningful suggestions
                    total_savings += save
                    recs.append({
                        "type": "category_cap",
                        "category": s["category"],
                        "title": f"Cap {s['category']} at {cap}",
                        "message": (
                            f"You spend {s['spent']:.0f}/month on {s['category']}. "
                            f"A {cap} budget would save about {save:.0f}/month."
                        ),
                        "severity": "warning" if save >= 50 else "info",
                        "current": s["spent"],
                        "suggested": cap,
                        "potential_savings": save,
                    })

            # Overall posture.
            if total_spent > total_income:
                recs.append({
                    "type": "over_budget",
                    "title": "Spending exceeds income",
                    "message": (
                        f"You spent {total_spent:.0f} on {total_income:.0f} of income "
                        f"this month. Consider cutting {round(total_spent - total_income, 2)} "
                        f"across your top categories."
                    ),
                    "severity": "warning",
                })
            else:
                recs.append({
                    "type": "saving",
                    "title": "Nice pace - lock it in",
                    "message": (
                        f"You're {round(total_income - total_spent, 2)} under income. "
                        f"Set a budget on your top categories to keep the momentum."
                    ),
                    "severity": "success",
                })

            if total_savings > 0:
                recs.append({
                    "type": "summary",
                    "title": "Estimated monthly savings",
                    "message": f"Applying these suggestions could save about {round(total_savings, 2)}/month.",
                    "severity": "success",
                    "potential_savings": round(total_savings, 2),
                })
        else:
            # No income on record - anchor on observed spending instead.
            if spending:
                biggest = spending[0]
                cap = round(biggest["spent"] * 0.8)
                recs.append({
                    "type": "category_cap",
                    "category": biggest["category"],
                    "title": f"Start with {biggest['category']}",
                    "message": (
                        f"Your biggest category is {biggest['category']} at "
                        f"{biggest['spent']:.0f}/month. A budget of {cap} would put it in check."
                    ),
                    "severity": "info",
                    "current": biggest["spent"],
                    "suggested": cap,
                    "potential_savings": max(0.0, round(biggest["spent"] - cap, 2)),
                })
                recs.append({
                    "type": "getting_started",
                    "title": "Set your monthly income",
                    "message": "Record your monthly income to unlock 50/30/20 allocation suggestions.",
                    "severity": "info",
                })
            else:
                recs.append({
                    "type": "getting_started",
                    "title": "Nothing to analyze yet",
                    "message": "Add a few transactions and we'll suggest a personalized budget.",
                    "severity": "info",
                })

        return recs

    def _recommend_from_budgets(self, budget_rows, spent_by_cat: Dict[str, float], cat_name_by_id: Dict[str, str]) -> List[Dict[str, Any]]:
        """Compare each active budget to actual spending and suggest cuts."""
        recs: List[Dict[str, Any]] = []
        total_savings = 0.0
        for amount, category_id in budget_rows:
            budget_amt = float(amount)
            name = cat_name_by_id.get(category_id, "Overall") if category_id else "Overall"
            spent = spent_by_cat.get(name, 0.0)
            over = spent - budget_amt
            pct = (spent / budget_amt * 100) if budget_amt > 0 else 0
            if over > 0:
                cut = round(over * 0.5, 2)
                total_savings += cut
                recs.append({
                    "type": "over_budget",
                    "category": name,
                    "title": f"{name}: over by {over:.0f}",
                    "message": (
                        f"You've spent {spent:.0f} of your {budget_amt:.0f} budget "
                        f"({pct:.0f}% used). Trimming about {cut} would bring it back in line."
                    ),
                    "severity": "warning",
                    "current": spent,
                    "suggested": round(budget_amt * 0.9, 2),
                    "potential_savings": cut,
                })
            else:
                recs.append({
                    "type": "on_track",
                    "category": name,
                    "title": f"{name}: on track",
                    "message": f"Spent {spent:.0f} of {budget_amt:.0f} ({pct:.0f}% used). Keep it up!",
                    "severity": "success",
                    "current": spent,
                    "suggested": budget_amt,
                })
        if total_savings > 0:
            recs.append({
                "type": "summary",
                "title": "Estimated monthly savings",
                "message": f"Bringing over-budget categories back in line could save about {round(total_savings, 2)}/month.",
                "severity": "success",
                "potential_savings": round(total_savings, 2),
            })
        return recs

    async def _polish(self, recommendations: List[Dict[str, Any]], spending: list, total_income: float) -> List[Dict[str, Any]]:
        """Best-effort LLM headline from the structured cards. Never blocks the result."""
        if not recommendations or not settings.OLLAMA_BASE_URL:
            return []
        context = {
            "total_income_30d": total_income,
            "top_spenders": spending[:5],
            "suggestions": [r.get("message", "") for r in recommendations[:3]],
        }
        prompt = (
            "You are a warm, encouraging personal finance advisor. Summarize the "
            f"following data into ONE 1-2 sentence headline. Data: "
            f"{json.dumps(context)}. Reply with the headline only, no JSON."
        )
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False},
                )
                resp.raise_for_status()
                text = (resp.json().get("response") or "").strip()
            if text:
                headline = {"type": "headline", "title": "Your advisor", "message": text, "severity": "info"}
                return [headline] + [r for r in recommendations if r.get("type") != "summary"]
        except Exception:
            return []
        return []

