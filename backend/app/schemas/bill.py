from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

class BillCreate(BaseModel):
    name: str
    amount: float = Field(..., gt=0)
    due_date: date
    category_id: Optional[str] = None
    notes: Optional[str] = None

class BillUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    is_paid: Optional[bool] = None
    paid_date: Optional[date] = None
    category_id: Optional[str] = None
    notes: Optional[str] = None

class BillResponse(BaseModel):
    id: str
    name: str
    amount: float
    due_date: date
    file_path: Optional[str] = None
    ocr_text: Optional[str] = None
    is_paid: bool
    paid_date: Optional[date] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BillUploadResponse(BillResponse):
    extracted_amount: Optional[float] = None
    extracted_due_date: Optional[str] = None
    extracted_merchant: Optional[str] = None
    confidence: float = 0
