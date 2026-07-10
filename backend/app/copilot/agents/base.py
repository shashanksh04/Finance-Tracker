import json
from typing import List, Dict, Any, Optional
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage
from langchain_core.tools import tool
from app.core.config import settings
from app.copilot.tools import finance_tools


def create_llm(callbacks: Optional[list] = None) -> ChatOllama:
    kwargs = {
        "model": settings.OLLAMA_MODEL,
        "base_url": settings.OLLAMA_BASE_URL,
        "temperature": 0.1,
        "num_predict": 2048,
    }
    if settings.OLLAMA_API_KEY:
        kwargs["api_key"] = settings.OLLAMA_API_KEY
    if callbacks:
        kwargs["callbacks"] = callbacks
    return ChatOllama(**kwargs)


def dicts_to_langchain(messages: List[Dict]) -> List[BaseMessage]:
    result = []
    for m in messages:
        role = m.get("role", "")
        content = m.get("content", "")
        if role == "user":
            result.append(HumanMessage(content=content))
        elif role == "assistant":
            result.append(AIMessage(content=content))
        elif role == "system":
            result.append(SystemMessage(content=content))
        elif role == "tool":
            tid = m.get("tool_call_id", "")
            result.append(ToolMessage(content=content, tool_call_id=tid))
    return result


def langchain_to_dict(msg: BaseMessage) -> Dict:
    if isinstance(msg, HumanMessage):
        return {"role": "user", "content": msg.content}
    elif isinstance(msg, AIMessage):
        return {"role": "assistant", "content": msg.content}
    elif isinstance(msg, SystemMessage):
        return {"role": "system", "content": msg.content}
    elif isinstance(msg, ToolMessage):
        return {"role": "tool", "content": msg.content, "tool_call_id": msg.tool_call_id}
    return {"role": "unknown", "content": msg.content}


def create_tools(db, user_id: str, user) -> list:
    _db = db
    _uid = user_id
    _user = user

    @tool
    async def get_spending_by_category(category_name: Optional[str] = None, period: str = "this_month", type: str = "expense") -> str:
        """Get total spending for a category over a period of time. Returns breakdown by category with amounts."""
        result = await finance_tools.get_spending_by_category(db=_db, user_id=_uid, user=_user, category_name=category_name, period=period, type=type)
        return json.dumps(result, default=str)

    @tool
    async def get_budget_health() -> str:
        """Get budget vs actual spending for all active budgets this month. Returns each budget's status (on_track, warning, over)."""
        result = await finance_tools.get_budget_health(db=_db, user_id=_uid, user=_user)
        return json.dumps(result, default=str)

    @tool
    async def get_recent_transactions(limit: int = 10, category: Optional[str] = None, merchant: Optional[str] = None) -> str:
        """Get recent transactions with optional category or merchant filters."""
        result = await finance_tools.get_recent_transactions(db=_db, user_id=_uid, user=_user, limit=limit, category=category, merchant=merchant)
        return json.dumps(result, default=str)

    @tool
    async def get_upcoming_bills(days: int = 7) -> str:
        """Get bills due within a specified number of days. Returns bill names, amounts, and due dates."""
        result = await finance_tools.get_upcoming_bills(db=_db, user_id=_uid, user=_user, days=days)
        return json.dumps(result, default=str)

    @tool
    async def compare_periods(period_a: str = "this_month", period_b: str = "last_month", category: Optional[str] = None) -> str:
        """Compare income and expenses between two time periods. Shows the difference in spending patterns."""
        result = await finance_tools.compare_periods(db=_db, user_id=_uid, user=_user, period_a=period_a, period_b=period_b, category=category)
        return json.dumps(result, default=str)

    @tool
    async def get_goal_progress(status: str = "active") -> str:
        """Get progress on financial goals. Returns current amount, target, remaining, and deadline for each goal."""
        result = await finance_tools.get_goal_progress(db=_db, user_id=_uid, user=_user, status=status)
        return json.dumps(result, default=str)

    @tool
    async def get_goal_spending_impact() -> str:
        """Analyze how current spending affects each financial goal. Returns suggested monthly contribution vs actual monthly surplus/deficit and flags goals at risk."""
        result = await finance_tools.get_goal_spending_impact(db=_db, user_id=_uid, user=_user)
        return json.dumps(result, default=str)

    @tool
    async def get_accounts() -> str:
        """List all non-archived accounts with their types, balances, and currencies. Returns account names, types, and current balances."""
        result = await finance_tools.get_accounts(db=_db, user_id=_uid, user=_user)
        return json.dumps(result, default=str)

    @tool
    async def get_income_summary(period: str = "this_month", account_name: Optional[str] = None) -> str:
        """Get total income for a time period, optionally filtered by account. Returns total income, transaction count, and breakdown by income source."""
        result = await finance_tools.get_income_summary(db=_db, user_id=_uid, user=_user, period=period, account_name=account_name)
        return json.dumps(result, default=str)

    return [get_spending_by_category, get_budget_health, get_recent_transactions,
            get_upcoming_bills, compare_periods, get_goal_progress,
            get_goal_spending_impact, get_accounts, get_income_summary]
