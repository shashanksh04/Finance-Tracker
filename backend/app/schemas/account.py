from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AccountCreate(BaseModel):
    name: str = Field(..., max_length=100)
    type: str = Field(default="checking", pattern="^(checking|savings|credit|investment|cash)$")
    balance: float = 0
    currency: str = "USD"
    icon: Optional[str] = None
    color: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    balance: Optional[float] = None
    currency: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_archived: Optional[bool] = None

class AccountResponse(BaseModel):
    id: str
    name: str
    type: str
    balance: float
    currency: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AccountSummary(AccountResponse):
    transaction_count: int = 0
    total_income: float = 0
    total_expenses: float = 0
