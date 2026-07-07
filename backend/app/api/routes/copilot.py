from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.copilot import CopilotRequest, CopilotResponse, DecisionSimulationRequest, DecisionSimulationResponse
from app.copilot.copilot_service import CopilotService

router = APIRouter(prefix="/api/copilot", tags=["AI Copilot"])


@router.post("/chat", response_model=CopilotResponse)
async def chat(data: CopilotRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CopilotService(db, user=user)
    return await service.chat(user.id, data)


@router.post("/chat/stream")
async def chat_stream(data: CopilotRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CopilotService(db, user=user)
    return StreamingResponse(
        service.chat_stream(user.id, data),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/simulate", response_model=DecisionSimulationResponse)
async def simulate(data: DecisionSimulationRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CopilotService(db, user=user)
    return await service.simulate_decision(user.id, data)
