from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class AlertCreate(BaseModel):
    type: str
    title: str
    message: str
    severity: str = "info"
    category_id: Optional[str] = None
    related_amount: Optional[float] = None

class AlertPreferenceUpdate(BaseModel):
    enabled: bool
    threshold: Optional[float] = None

class AlertPreferenceResponse(BaseModel):
    id: str
    alert_type: str
    enabled: bool
    threshold: Optional[float] = None

    class Config:
        from_attributes = True

class AlertResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    severity: str
    category_id: Optional[str] = None
    related_amount: Optional[float] = None
    is_read: bool
    is_dismissed: bool
    created_at: datetime

    class Config:
        from_attributes = True
