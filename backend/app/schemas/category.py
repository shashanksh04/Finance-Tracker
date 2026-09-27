from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80, pattern=r"\S")
    icon: Optional[str] = Field(default=None, max_length=16)
    color: Optional[str] = Field(default=None, max_length=16)
    type: str = Field(..., pattern="^(income|expense)$")
    parent_id: Optional[str] = None
    sort_order: int = Field(default=0, ge=0, le=10000)

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    icon: Optional[str] = Field(default=None, max_length=16)
    color: Optional[str] = Field(default=None, max_length=16)
    parent_id: Optional[str] = None
    sort_order: Optional[int] = Field(default=None, ge=0, le=10000)

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
