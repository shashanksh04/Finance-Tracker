from typing import TypedDict, List, Dict, Any, Optional, Annotated, Callable


def _trim_messages(current: List[Dict], update: List[Dict]) -> List[Dict]:
    combined = current + update
    return combined[-5:]


class CopilotState(TypedDict):
    message: str
    user_id: str
    user: Dict[str, Any]
    session_id: Optional[str]
    messages: Annotated[List[Dict], _trim_messages]
    financial_context: str
    intent: str
    is_fast_path: bool
    plan: Optional[List[str]]
    agent_scratchpad: List[Dict]
    errors: List[str]
    final_response: str
    next_node: str
