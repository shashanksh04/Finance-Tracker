from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date

class TransactionCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    amount: float = Field(..., gt=0)
    type: str = Field(..., pattern="^(income|expense|transfer)$")
    description: str = ""
    merchant: Optional[str] = None
    date: date
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    is_split: bool = False

class TransactionUpdate(BaseModel):
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = Field(None, pattern="^(income|expense|transfer)$")
    description: Optional[str] = None
    merchant: Optional[str] = None
    date: Optional[date] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class TransactionResponse(BaseModel):
    id: str
    account_id: str
    account_name: str = ""
    user_id: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    amount: float
    type: str
    description: str
    merchant: Optional[str] = None
    date: date
    is_recurring: bool
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TransactionFilterParams(BaseModel):
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    merchant: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 50
    sort_by: str = "date"
    sort_order: str = "desc"

class PaginatedTransactions(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
