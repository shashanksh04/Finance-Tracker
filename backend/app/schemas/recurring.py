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
    amount: Optional[float] = Field(default=None, gt=0)
    description: Optional[str] = Field(default=None, max_length=500)
    merchant: Optional[str] = Field(default=None, max_length=120)
    frequency: Optional[str] = Field(default=None, pattern="^(daily|weekly|biweekly|monthly|quarterly|yearly)$")
    interval_value: Optional[int] = Field(default=None, ge=1, le=365)
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
