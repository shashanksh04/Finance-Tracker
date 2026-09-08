import uuid
from datetime import date
from typing import List, Optional

from langchain_core.tools import tool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.bill import Bill
from app.models.category import Category
from app.models.transaction import Transaction

ALLOWED_TX_TYPES = ("income", "expense", "transfer")
ALLOWED_ACCOUNT_TYPES = ("checking", "savings", "credit", "investment", "cash")
ALLOWED_BUDGET_PERIODS = ("monthly", "quarterly", "yearly")
ALLOWED_CATEGORY_TYPES = ("income", "expense")

MAX_MATCHES = 5


def _cc(user) -> str:
    cur = (user.settings or {}).get("currency", "USD") if user else "USD"
    sym = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥",
           "CAD": "C$", "AUD": "A$", "SGD": "S$", "CHF": "Fr", "CNY": "¥"}
    return sym.get(cur, "$")


def _money(user, amount) -> str:
    return f"{_cc(user)}{float(amount):,.2f}"


def _parse_date(value) -> date:
    if not value:
        return date.today()
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return date.today()


def _escape_like(v: str) -> str:
    return v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _append_action(proposed_actions: List[dict], action_type: str, summary: str, payload: dict) -> None:
    aid = f"act_{uuid.uuid4().hex[:10]}"
    try:
        from app.core.redis import get_redis
        import asyncio
        async def _store():
            try:
                r = await get_redis()
                await r.setex(f"proposed_action:{aid}", 86400, "1")
            except Exception:
                pass
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_store())
        except RuntimeError:
            pass
    except Exception:
        pass
    proposed_actions.append({
        "id": aid,
        "action_type": action_type,
        "summary": summary,
        "payload": payload,
    })


async def _resolve_category_id(db: AsyncSession, user_id: str, name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    esc = _escape_like(name.lower())
    result = await db.execute(
        select(Category).where(
            Category.user_id == user_id,
            func.lower(Category.name) == name.lower(),
            Category.deleted_at.is_(None),
        ).order_by(Category.sort_order).limit(1)
    )
    cat = result.scalar_one_or_none()
    if cat:
        return str(cat.id)
    return None


async def _resolve_account_id(db: AsyncSession, user_id: str, name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    result = await db.execute(
        select(Account).where(
            Account.user_id == user_id,
            func.lower(Account.name) == name.lower(),
            Account.deleted_at.is_(None),
        ).order_by(Account.created_at).limit(1)
    )
    acct = result.scalar_one_or_none()
    return str(acct.id) if acct else None


async def _default_account(db: AsyncSession, user_id: str) -> Optional[Account]:
    from app.models.transaction import Transaction
    result = await db.execute(
        select(Account, func.count(Transaction.id).label("cnt"))
        .outerjoin(Transaction, (Transaction.account_id == Account.id) & (Transaction.deleted_at.is_(None)))
        .where(Account.user_id == user_id, Account.is_archived == False, Account.deleted_at.is_(None))  # noqa: E712
        .group_by(Account.id)
        .order_by(func.count(Transaction.id).desc(), Account.created_at)
        .limit(1)
    )
    row = result.first()
    if row:
        return row[0]
    result2 = await db.execute(
        select(Account).where(Account.user_id == user_id, Account.is_archived == False, Account.deleted_at.is_(None)).order_by(Account.created_at).limit(1)
    )
    return result2.scalar_one_or_none()


async def _find_transactions(db: AsyncSession, user_id: str, id: Optional[str] = None, search: Optional[str] = None):
    if id:
        result = await db.execute(
            select(Transaction).where(Transaction.user_id == user_id, Transaction.id == id).limit(1)
        )
        return result.scalars().all()
    if search:
        result = await db.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                func.lower(func.coalesce(Transaction.description, "")).contains(search.lower()),
            ).order_by(Transaction.date.desc()).limit(MAX_MATCHES)
        )
        return result.scalars().all()
    return []


async def _find_bill(db: AsyncSession, user_id: str, id: Optional[str] = None, name: Optional[str] = None) -> Optional[Bill]:
    if id:
        result = await db.execute(select(Bill).where(Bill.user_id == user_id, Bill.id == id).limit(1))
        return result.scalar_one_or_none()
    if name:
        result = await db.execute(
            select(Bill).where(
                Bill.user_id == user_id,
                func.lower(Bill.name).contains(name.lower()),
            ).order_by(Bill.due_date).limit(1)
        )
        return result.scalar_one_or_none()
    return None


def make_action_tools(db: AsyncSession, user_id: str, user, proposed_actions: List[dict]) -> list:
    @tool
    async def create_transaction(
        description: str,
        amount: float,
        type: str = "expense",
        category_name: Optional[str] = None,
        account_name: Optional[str] = None,
        merchant: Optional[str] = None,
        date: Optional[str] = None,
    ) -> str:
        """Propose adding a new transaction (expense, income, or transfer). Does NOT record it — the user must confirm first."""
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return "Error: amount must be a number."
        if amount <= 0:
            return "Error: amount must be greater than zero."
        if type not in ALLOWED_TX_TYPES:
            return f"Error: type must be one of {', '.join(ALLOWED_TX_TYPES)}."
        if not description or not description.strip():
            return "Error: a description is required."

        category_id = None
        if category_name:
            category_id = await _resolve_category_id(db, user_id, category_name)

        account_id = await _resolve_account_id(db, user_id, account_name)
        if not account_id:
            acct = await _default_account(db, user_id)
            if not acct:
                return "Error: no account found. Please create an account first."
            account_id = str(acct.id)

        payload = {
            "account_id": account_id,
            "amount": amount,
            "type": type,
            "description": description.strip(),
            "date": _parse_date(date).isoformat(),
        }
        if category_id:
            payload["category_id"] = category_id
        if merchant:
            payload["merchant"] = merchant

        summary = f"Add {type} of {_money(user, amount)} for '{description.strip()}'"
        if category_name:
            summary += f" in category '{category_name}'"
        if account_name:
            summary += f" to account '{account_name}'"
        summary += f" on {_parse_date(date).isoformat()}"

        _append_action(proposed_actions, "create_transaction", summary, payload)
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    @tool
    async def update_transaction(
        id: Optional[str] = None,
        search: Optional[str] = None,
        amount: Optional[float] = None,
        description: Optional[str] = None,
        type: Optional[str] = None,
        category_name: Optional[str] = None,
        merchant: Optional[str] = None,
        date: Optional[str] = None,
    ) -> str:
        """Propose editing an existing transaction found by id or by a search term. Does NOT edit it — the user must confirm first."""
        if not id and not search:
            return "Error: provide either 'id' or 'search' to identify the transaction."
        txns = await _find_transactions(db, user_id, id=id, search=search)
        if not txns:
            return "Error: no matching transaction found."
        if len(txns) > 1:
            names = "; ".join(f"'{t.description}' {_money(user, t.amount)} on {t.date}" for t in txns)
            return f"Error: found {len(txns)} matching transactions. Please be more specific. Matches: {names}"
        txn = txns[0]

        changes: dict = {}
        if amount is not None:
            try:
                amount = float(amount)
            except (TypeError, ValueError):
                return "Error: amount must be a number."
            if amount <= 0:
                return "Error: amount must be greater than zero."
            changes["amount"] = amount
        if description and description.strip():
            changes["description"] = description.strip()
        if type:
            if type not in ALLOWED_TX_TYPES:
                return f"Error: type must be one of {', '.join(ALLOWED_TX_TYPES)}."
            changes["type"] = type
        if category_name:
            cat_id = await _resolve_category_id(db, user_id, category_name)
            if cat_id:
                changes["category_id"] = cat_id
        if merchant:
            changes["merchant"] = merchant
        if date:
            changes["date"] = _parse_date(date).isoformat()

        if not changes:
            return "Error: nothing to update. Provide at least one field to change."

        summary = f"Update transaction '{txn.description}' ({_money(user, txn.amount)} on {txn.date})"
        if amount is not None:
            summary += f" — new amount {_money(user, amount)}"
        if description and description.strip():
            summary += f" — description '{description.strip()}'"
        if category_name:
            summary += f" — category '{category_name}'"
        if date:
            summary += f" — date {_parse_date(date).isoformat()}"

        _append_action(proposed_actions, "update_transaction", summary, {"id": str(txn.id), "data": changes})
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    @tool
    async def delete_transaction(
        id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> str:
        """Propose deleting a transaction found by id or search term. Does NOT delete it — the user must confirm first."""
        if not id and not search:
            return "Error: provide either 'id' or 'search' to identify the transaction."
        txns = await _find_transactions(db, user_id, id=id, search=search)
        if not txns:
            return "Error: no matching transaction found."
        if len(txns) > 1:
            names = "; ".join(f"'{t.description}' {_money(user, t.amount)} on {t.date}" for t in txns)
            return f"Error: found {len(txns)} matching transactions. Please be more specific. Matches: {names}"
        txn = txns[0]

        summary = f"Delete transaction '{txn.description}' ({_money(user, txn.amount)} on {txn.date})"
        _append_action(proposed_actions, "delete_transaction", summary, {"id": str(txn.id)})
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    @tool
    async def create_budget(
        amount: float,
        period: str = "monthly",
        category_name: Optional[str] = None,
        start_date: Optional[str] = None,
    ) -> str:
        """Propose creating a budget (overall or per category) for a period. Does NOT create it — the user must confirm first."""
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return "Error: amount must be a number."
        if amount <= 0:
            return "Error: amount must be greater than zero."
        if period not in ALLOWED_BUDGET_PERIODS:
            return f"Error: period must be one of {', '.join(ALLOWED_BUDGET_PERIODS)}."

        category_id = None
        if category_name:
            category_id = await _resolve_category_id(db, user_id, category_name)

        start = _parse_date(start_date).isoformat()
        payload = {"amount": amount, "period": period, "start_date": start}
        if category_id:
            payload["category_id"] = category_id

        target = f"category '{category_name}'" if category_name else "overall"
        summary = f"Create a {period} budget of {_money(user, amount)} for {target} starting {start}"
        _append_action(proposed_actions, "create_budget", summary, payload)
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    @tool
    async def create_goal(
        name: str,
        target_amount: float,
        deadline: Optional[str] = None,
        category_name: Optional[str] = None,
        monthly_contribution: Optional[float] = None,
    ) -> str:
        """Propose creating a savings goal. Does NOT create it — the user must confirm first."""
        if not name or not name.strip():
            return "Error: a goal name is required."
        try:
            target_amount = float(target_amount)
        except (TypeError, ValueError):
            return "Error: target amount must be a number."
        if target_amount <= 0:
            return "Error: target amount must be greater than zero."

        category_id = None
        if category_name:
            category_id = await _resolve_category_id(db, user_id, category_name)

        payload = {"name": name.strip(), "target_amount": target_amount}
        if deadline:
            payload["deadline"] = _parse_date(deadline).isoformat()
        if category_id:
            payload["category_id"] = category_id
        if monthly_contribution is not None:
            payload["monthly_contribution"] = float(monthly_contribution)

        summary = f"Create goal '{name.strip()}' with target {_money(user, target_amount)}"
        if deadline:
            summary += f" by {_parse_date(deadline).isoformat()}"
        _append_action(proposed_actions, "create_goal", summary, payload)
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    @tool
    async def create_category(
        name: str,
        type: str = "expense",
        icon: Optional[str] = None,
        color: Optional[str] = None,
    ) -> str:
        """Propose creating a spending category. Does NOT create it — the user must confirm first."""
        if not name or not name.strip():
            return "Error: a category name is required."
        if type not in ALLOWED_CATEGORY_TYPES:
            return f"Error: type must be one of {', '.join(ALLOWED_CATEGORY_TYPES)}."

        payload = {"name": name.strip(), "type": type}
        if icon:
            payload["icon"] = icon
        if color:
            payload["color"] = color

        summary = f"Create {type} category '{name.strip()}'"
        _append_action(proposed_actions, "create_category", summary, payload)
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    @tool
    async def create_account(
        name: str,
        type: str = "checking",
        balance: float = 0.0,
        currency: Optional[str] = None,
    ) -> str:
        """Propose creating a financial account. Does NOT create it — the user must confirm first."""
        if not name or not name.strip():
            return "Error: an account name is required."
        if type not in ALLOWED_ACCOUNT_TYPES:
            return f"Error: type must be one of {', '.join(ALLOWED_ACCOUNT_TYPES)}."
        try:
            balance = float(balance)
        except (TypeError, ValueError):
            balance = 0.0

        cur = currency or (user.settings or {}).get("currency", "USD") if user else "USD"
        payload = {"name": name.strip(), "type": type, "balance": balance, "currency": cur}
        summary = f"Create {type} account '{name.strip()}' with opening balance {_money(user, balance)} in {cur}"
        _append_action(proposed_actions, "create_account", summary, payload)
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    @tool
    async def mark_bill_paid(
        name: str | None = None,
        id: Optional[str] = None,
    ) -> str:
        """Propose marking a bill as paid. Does NOT update it — the user must confirm first."""
        bill = await _find_bill(db, user_id, id=id, name=name)
        if not bill:
            return "Error: no matching bill found."
        if bill.is_paid:
            return f"Bill '{bill.name}' is already marked as paid."

        summary = f"Mark bill '{bill.name}' ({_money(user, bill.amount)} due {bill.due_date}) as paid"
        _append_action(proposed_actions, "mark_bill_paid", summary, {
            "id": str(bill.id),
            "data": {"is_paid": True, "paid_date": date.today().isoformat()},
        })
        return f"Proposed but NOT executed: {summary}. Waiting for the user to confirm."

    return [
        create_transaction,
        update_transaction,
        delete_transaction,
        create_budget,
        create_goal,
        create_category,
        create_account,
        mark_bill_paid,
    ]