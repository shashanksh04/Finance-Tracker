from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date

class BudgetCreate(BaseModel):
    category_id: Optional[str] = None
    amount: float = Field(..., gt=0)
    period: str = Field(..., pattern="^(monthly|quarterly|yearly)$")
    start_date: date
    end_date: Optional[date] = None
    rollover: bool = False

class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    period: Optional[str] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    rollover: Optional[bool] = None

class BudgetResponse(BaseModel):
    id: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    amount: float
    period: str
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    rollover: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    spent: float = 0
    remaining: float = 0
    percentage: float = 0

    class Config:
        from_attributes = True
