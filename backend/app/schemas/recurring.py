from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

class RecurringCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    amount: float = Field(..., gt=0)
    type: str = Field(..., pattern="^(income|expense)$")
    description: str = ""
    merchant: Optional[str] = None
    frequency: str = Field(..., pattern="^(daily|weekly|biweekly|monthly|quarterly|yearly)$")
    interval_value: int = 1
    next_date: date
    end_date: Optional[date] = None

class RecurringUpdate(BaseModel):
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    merchant: Optional[str] = None
    frequency: Optional[str] = None
    interval_value: Optional[int] = None
    next_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None

class RecurringResponse(BaseModel):
    id: str
    account_id: str
    account_name: str = ""
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    amount: float
    type: str
    description: str
    merchant: Optional[str] = None
    frequency: str
    interval_value: int
    next_date: date
    end_date: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
