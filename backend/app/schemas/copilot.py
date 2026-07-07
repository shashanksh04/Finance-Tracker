from pydantic import BaseModel
from typing import Optional, List


class CopilotMessage(BaseModel):
    role: str
    content: Optional[str] = None


class CopilotRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    conversation_history: Optional[List[CopilotMessage]] = []
    context_type: Optional[str] = None


class CopilotResponse(BaseModel):
    reply: str
    session_id: str = ""
    suggested_actions: Optional[List[dict]] = None
    insights: Optional[List[str]] = None


class StreamChunk(BaseModel):
    type: str
    content: str


class DecisionSimulationRequest(BaseModel):
    scenario: str
    amount: float
    category: Optional[str] = None
    timeframe: str = "monthly"


class DecisionSimulationResponse(BaseModel):
    impact_analysis: str
    recommendations: List[str]
    risk_level: str
    projected_outcome: dict
