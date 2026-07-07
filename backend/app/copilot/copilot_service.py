import asyncio
import json
import uuid
from typing import AsyncGenerator, Optional
import httpx
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.callbacks import AsyncCallbackHandler
from app.core.config import settings
from app.schemas.copilot import (
    CopilotRequest,
    CopilotResponse,
    DecisionSimulationRequest,
    DecisionSimulationResponse,
)
from app.copilot.graph import build_copilot_graph
from app.copilot.agents.base import create_llm
from app.copilot.nodes.insight_generator import run_insights
from app.models.transaction import Transaction
from datetime import date


class StreamingCallbackHandler(AsyncCallbackHandler):
    def __init__(self, queue: asyncio.Queue):
        self.queue = queue

    async def on_llm_new_token(self, token: str, **kwargs):
        if token:
            await self.queue.put(("token", token))

    async def on_tool_start(self, serialized: dict, input_str: str, **kwargs):
        name = serialized.get("name", "tool")
        await self.queue.put(("status", f"Running {name}..."))

    async def on_tool_end(self, output: str, **kwargs):
        await self.queue.put(("status", "Tool complete"))


class CopilotService:
    def __init__(self, db: AsyncSession, user=None):
        self.db = db
        self.user = user

    def _build_state(self, user_id: str, request: CopilotRequest, session_id: Optional[str]) -> dict:
        return {
            "message": request.message,
            "user_id": user_id,
            "user": {
                "id": str(self.user.id) if self.user else "",
                "full_name": self.user.full_name or "" if self.user else "",
                "settings": self.user.settings or {} if self.user else {},
            },
            "session_id": session_id or request.session_id,
            "messages": [],
            "financial_context": "",
            "intent": "",
            "is_fast_path": False,
            "plan": None,
            "agent_scratchpad": [],
            "errors": [],
            "final_response": "",
            "next_node": "input_parser",
        }

    async def chat(self, user_id: str, request: CopilotRequest) -> CopilotResponse:
        llm = create_llm()
        graph = build_copilot_graph(self.db, self.user, llm)
        state = self._build_state(user_id, request, None)
        final_state = await graph.ainvoke(state)
        return CopilotResponse(
            reply=final_state.get("final_response", ""),
            session_id=final_state.get("session_id", ""),
            suggested_actions=[],
            insights=[],
        )

    async def chat_stream(
        self, user_id: str, request: CopilotRequest
    ) -> AsyncGenerator[str, None]:
        session_id = request.session_id or str(uuid.uuid4())
        yield self._sse_event("session_id", session_id)
        yield self._sse_event("status", "Analyzing your finances...")

        queue = asyncio.Queue()
        callback = StreamingCallbackHandler(queue)
        llm = create_llm(callbacks=[callback])
        graph = build_copilot_graph(self.db, self.user, llm)
        state = self._build_state(user_id, request, session_id)

        graph_task = asyncio.create_task(graph.ainvoke(state))

        reply_parts = []
        done = False
        while not done:
            try:
                event_type, content = await asyncio.wait_for(queue.get(), timeout=0.3)
                if event_type == "token":
                    reply_parts.append(content)
                    yield self._sse_event("token", content)
                elif event_type == "status":
                    yield self._sse_event("status", content)
            except asyncio.TimeoutError:
                if graph_task.done():
                    if graph_task.cancelled():
                        yield self._sse_event("error", "Request cancelled")
                        return
                    if graph_task.exception():
                        err = str(graph_task.exception())
                        yield self._sse_event("error", err)
                        return
                    while not queue.empty():
                        et, c = queue.get_nowait()
                        if et == "token":
                            reply_parts.append(c)
                            yield self._sse_event("token", c)
                    done = True

        reply = "".join(reply_parts)
        yield self._sse_event("done", session_id)

        try:
            final_state = graph_task.result()
        except Exception:
            final_state = state

        if not reply:
            reply = final_state.get("final_response", "")

        asyncio.create_task(
            run_insights(self.db, user_id, self.user, final_state.get("messages", []))
        )

    async def simulate_decision(
        self, user_id: str, request: DecisionSimulationRequest
    ) -> DecisionSimulationResponse:
        today = date.today()
        month_start = today.replace(day=1)
        r = await self.db.execute(
            select(sa_func.coalesce(sa_func.sum(Transaction.amount), 0))
            .where(
                Transaction.user_id == user_id,
                Transaction.date >= month_start,
                Transaction.type == "expense",
            )
        )
        monthly_expense = float(r.scalar() or 0)

        prompt = (
            f"You are a financial advisor. The user is considering spending "
            f"{request.amount:.2f} on '{request.scenario}' "
            f"in the '{request.category or 'general'}' category ({request.timeframe}).\n\n"
            f"Current monthly expenses: ₹{monthly_expense:.2f}\n\n"
            f"Provide:\n1. Impact analysis\n2. 3-5 recommendations\n"
            f"3. Risk level (low/medium/high)\n4. Projected outcome in JSON\n\n"
            f"Be realistic and actionable."
        )

        async with httpx.AsyncClient(timeout=30) as client:
            headers = {}
            if settings.OLLAMA_API_KEY:
                headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"num_predict": 1024},
            }
            try:
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                reply = response.json().get("message", {}).get("content", "")
            except Exception:
                reply = "Unable to run simulation. Please try again."

        risk = "medium"
        if "low risk" in reply.lower():
            risk = "low"
        elif "high risk" in reply.lower():
            risk = "high"

        return DecisionSimulationResponse(
            impact_analysis=reply,
            recommendations=[
                r.strip()
                for r in reply.split("\n")
                if r.strip()
                and any(r.strip().startswith(p) for p in ("-", "1", "2", "3", "4", "5", "*"))
            ][:5],
            risk_level=risk,
            projected_outcome={
                "scenario": request.scenario,
                "amount": request.amount,
                "risk": risk,
            },
        )

    def _sse_event(self, event_type: str, data) -> str:
        payload = json.dumps({"type": event_type, "content": data}, default=str)
        return f"data: {payload}\n\n"
