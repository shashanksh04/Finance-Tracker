from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, date

class PeriodAnalysisRequest(BaseModel):
    period: str  # 'monthly', 'quarterly', 'yearly'
    year: int
    month: Optional[int] = None
    quarter: Optional[int] = None
    account_id: Optional[str] = None
    category_id: Optional[str] = None

class SpendingTrend(BaseModel):
    period_label: str
    income: float
    expenses: float
    net: float
    transaction_count: int

class CategoryBreakdown(BaseModel):
    category_id: str
    category_name: str
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    amount: float
    percentage: float
    transaction_count: int

class PeriodAnalysisResponse(BaseModel):
    period: str
    label: str
    total_income: float
    total_expenses: float
    net_savings: float
    savings_rate: float
    transaction_count: int
    category_breakdown: List[CategoryBreakdown]
    trends: List[SpendingTrend]
    top_merchants: List[dict]
    insights: List[str]

class ComparisonRequest(BaseModel):
    period1: str
    period2: str

class ComparisonResponse(BaseModel):
    income_change: float
    expense_change: float
    savings_change: float
    top_changes: List[dict]
    insights: List[str]

class DashboardSummary(BaseModel):
    total_balance: float
    monthly_income: float
    monthly_expenses: float
    net_worth_change: float
    budget_health: List[dict]
    recent_transactions: List[Any]
    upcoming_bills: List[Any]
    alerts: List[Any]
    goal_progress: List[Any]
    spending_by_category: List[CategoryBreakdown]
