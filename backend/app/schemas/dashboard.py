from pydantic import BaseModel
from typing import Optional, List, Any

class ChartDataPoint(BaseModel):
    label: str
    value: float
    secondary_value: Optional[float] = None

class DashboardWidget(BaseModel):
    id: str
    type: str
    title: str
    data: Any
    config: Optional[dict] = None
