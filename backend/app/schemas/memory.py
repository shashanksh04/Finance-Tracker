from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MemoryCreate(BaseModel):
    key: str
    value: str
    context: Optional[str] = None
    memory_type: str = "fact"
    importance: float = 0.5

class MemoryUpdate(BaseModel):
    value: Optional[str] = None
    context: Optional[str] = None
    importance: Optional[float] = None

class MemoryResponse(BaseModel):
    id: str
    key: str
    value: str
    context: Optional[str] = None
    memory_type: str
    importance: float
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
