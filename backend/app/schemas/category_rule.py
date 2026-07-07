from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CategoryRuleCreate(BaseModel):
    category_id: str
    contains_keyword: Optional[str] = None
    merchant_name: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    priority: int = 0

class CategoryRuleUpdate(BaseModel):
    category_id: Optional[str] = None
    contains_keyword: Optional[str] = None
    merchant_name: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None

class CategoryRuleResponse(BaseModel):
    id: str
    category_id: str
    category_name: str = ""
    contains_keyword: Optional[str] = None
    merchant_name: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    priority: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
