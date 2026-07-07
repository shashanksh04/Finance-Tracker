from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date

class GoalCreate(BaseModel):
    name: str = Field(..., max_length=200)
    target_amount: float = Field(..., gt=0)
    current_amount: float = 0
    deadline: Optional[date] = None
    category_id: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    monthly_contribution: Optional[float] = None
    notes: Optional[str] = None

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[date] = None
    category_id: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    monthly_contribution: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class GoalResponse(BaseModel):
    id: str
    name: str
    target_amount: float
    current_amount: float
    deadline: Optional[date] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    status: str
    monthly_contribution: Optional[float] = None
    notes: Optional[str] = None
    progress_percentage: float = 0
    days_remaining: Optional[int] = None
    suggested_monthly: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
