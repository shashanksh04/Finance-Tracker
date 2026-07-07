from app.copilot.intent_router import classify_intent, is_direct_answer_intent
from app.copilot.state import CopilotState


def make_router():
    async def router(state: CopilotState) -> dict:
        intent = classify_intent(state["message"])
        is_fast_path = is_direct_answer_intent(intent)
        return {"intent": intent, "is_fast_path": is_fast_path}
    return router
