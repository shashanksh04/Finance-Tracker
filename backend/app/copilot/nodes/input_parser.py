import json
import uuid
from typing import Optional
from app.core.redis import get_redis
from app.core.config import settings
from app.copilot.state import CopilotState

CONVERSATION_TTL = getattr(settings, "CONVERSATION_TTL_HOURS", 24) * 3600


def make_input_parser():
    async def input_parser(state: CopilotState) -> dict:
        session_id = state.get("session_id")
        messages = []

        if session_id:
            try:
                redis = await get_redis()
                key = f"conversation:{state['user_id']}:{session_id}"
                data = await redis.get(key)
                if data:
                    messages = json.loads(data)
                    await redis.expire(key, CONVERSATION_TTL)
            except Exception:
                pass
        else:
            session_id = str(uuid.uuid4())

        messages.append({"role": "user", "content": state["message"]})
        return {"messages": messages, "session_id": session_id}
    return input_parser
