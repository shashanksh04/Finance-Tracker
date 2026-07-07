from typing import Any, Callable
from app.copilot.tools.finance_tools import (
    get_spending_by_category,
    get_budget_health,
    get_recent_transactions,
    get_upcoming_bills,
    compare_periods,
    get_goal_progress,
    get_accounts,
    get_income_summary,
)

FINANCE_TOOLS: dict[str, dict[str, Any]] = {
    "get_spending_by_category": {
        "function": get_spending_by_category,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_spending_by_category",
                "description": "Get total spending for a category over a period of time. Returns breakdown by category with amounts.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "category_name": {
                            "type": "string",
                            "description": "Category name to filter by (omit for all categories)",
                        },
                        "period": {
                            "type": "string",
                            "enum": ["this_month", "last_month", "this_year", "last_3_months"],
                            "description": "Time period to analyze",
                        },
                        "type": {
                            "type": "string",
                            "enum": ["expense", "income", "both"],
                            "description": "Transaction type",
                        },
                    },
                },
            },
        },
    },
    "get_budget_health": {
        "function": get_budget_health,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_budget_health",
                "description": "Get budget vs actual spending for all active budgets this month. Returns each budget's status (on_track, warning, over).",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
        },
    },
    "get_recent_transactions": {
        "function": get_recent_transactions,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_recent_transactions",
                "description": "Get recent transactions with optional category or merchant filters.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Number of transactions to return (default 10)",
                        },
                        "category": {
                            "type": "string",
                            "description": "Filter by category name",
                        },
                        "merchant": {
                            "type": "string",
                            "description": "Filter by merchant name (partial match)",
                        },
                    },
                },
            },
        },
    },
    "get_upcoming_bills": {
        "function": get_upcoming_bills,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_upcoming_bills",
                "description": "Get bills due within a specified number of days. Returns bill names, amounts, and due dates.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "integer",
                            "description": "Number of days to look ahead (default 7)",
                        },
                    },
                },
            },
        },
    },
    "compare_periods": {
        "function": compare_periods,
        "schema": {
            "type": "function",
            "function": {
                "name": "compare_periods",
                "description": "Compare income and expenses between two time periods. Shows the difference in spending patterns.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "period_a": {
                            "type": "string",
                            "enum": ["this_month", "last_month", "this_year", "last_year"],
                            "description": "First period to compare",
                        },
                        "period_b": {
                            "type": "string",
                            "enum": ["this_month", "last_month", "this_year", "last_year"],
                            "description": "Second period to compare",
                        },
                        "category": {
                            "type": "string",
                            "description": "Optional category to compare",
                        },
                    },
                },
            },
        },
    },
    "get_goal_progress": {
        "function": get_goal_progress,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_goal_progress",
                "description": "Get progress on financial goals. Returns current amount, target, remaining, and deadline for each goal.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["active", "completed", "all"],
                            "description": "Filter goals by status",
                        },
                    },
                },
            },
        },
    },
    "get_accounts": {
        "function": get_accounts,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_accounts",
                "description": "List all non-archived accounts with their types, balances, and currencies. Returns account names, types (checking, savings, credit, cash, investment), and current balances.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
        },
    },
    "get_income_summary": {
        "function": get_income_summary,
        "schema": {
            "type": "function",
            "function": {
                "name": "get_income_summary",
                "description": "Get total income for a time period, optionally filtered by account. Returns total income, transaction count, and breakdown by income source/category.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "period": {
                            "type": "string",
                            "enum": ["this_month", "last_month", "this_year", "last_3_months", "all"],
                            "description": "Time period to analyze",
                        },
                        "account_name": {
                            "type": "string",
                            "description": "Optional account name to filter by (e.g. 'HDFC Checking', 'ICICI Savings')",
                        },
                    },
                },
            },
        },
    },
}


def get_tool_schemas() -> list[dict]:
    return [info["schema"] for info in FINANCE_TOOLS.values()]


async def execute_tool(db, user_id, user, tool_name: str, arguments: dict) -> Any:
    info = FINANCE_TOOLS.get(tool_name)
    if not info:
        raise ValueError(f"Unknown tool: {tool_name}")
    fn = info["function"]
    return await fn(db=db, user_id=user_id, user=user, **arguments)
