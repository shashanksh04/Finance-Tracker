import json
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.redis import get_redis
from app.core.config import settings
from app.models.memory import FinancialMemory
from app.embeddings.embedding_service import EmbeddingService
from app.copilot.state import CopilotState

CONVERSATION_TTL = getattr(settings, "CONVERSATION_TTL_HOURS", 24) * 3600


def make_response_emitter(db: AsyncSession, user):
    async def response_emitter(state: CopilotState) -> dict:
        session_id = state.get("session_id")
        assistant_msg = {"role": "assistant", "content": state["final_response"]}

        if session_id:
            try:
                redis = await get_redis()
                key = f"conversation:{state['user_id']}:{session_id}"
                all_msgs = state["messages"] + [assistant_msg]
                trimmed = all_msgs[-10:]
                await redis.setex(key, CONVERSATION_TTL, json.dumps(trimmed))
            except Exception:
                pass

        try:
            user_msg = state["messages"][-1]["content"] if state["messages"] else state["message"]
            text = f"Q: {user_msg}\nA: {state['final_response'][:500]}"
            embedding = await EmbeddingService.embed(text)
            memory = FinancialMemory(
                user_id=state["user_id"],
                key=f"conv_{date.today().isoformat()}",
                value=state["final_response"][:500],
                context=user_msg[:200],
                embedding=embedding,
                embedding_vector=embedding,
                memory_type="conversation",
                importance=0.5,
            )
            db.add(memory)
            await db.flush()
        except Exception:
            pass

        return {"messages": [assistant_msg], "agent_scratchpad": []}
    return response_emitter
