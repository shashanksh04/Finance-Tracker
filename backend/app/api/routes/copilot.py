from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.copilot import CopilotRequest, CopilotResponse, DecisionSimulationRequest, DecisionSimulationResponse
from app.api.routes.auth import limiter
from app.copilot.copilot_service import CopilotService

router = APIRouter(prefix="/api/copilot", tags=["AI Copilot"])


@router.post("/chat", response_model=CopilotResponse)
@limiter.limit("30/minute")
async def chat(request: Request, data: CopilotRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CopilotService(db, user=user)
    return await service.chat(user.id, data)


@router.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, data: CopilotRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
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
@limiter.limit("20/minute")
async def simulate(request: Request, data: DecisionSimulationRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = CopilotService(db, user=user)
    return await service.simulate_decision(user.id, data)
