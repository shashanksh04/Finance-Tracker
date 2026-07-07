from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    type: str  # 'income' or 'expense'
    parent_id: Optional[str] = None
    sort_order: int = 0

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    type: str
    parent_id: Optional[str] = None
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True

class CategoryWithChildren(CategoryResponse):
    children: List["CategoryWithChildren"] = []
    total_spent: float = 0
    budget_amount: Optional[float] = None
