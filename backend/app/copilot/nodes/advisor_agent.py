from langchain_core.messages import SystemMessage
from langchain_ollama import ChatOllama
from app.copilot.state import CopilotState
from app.copilot.agents.base import dicts_to_langchain


def make_advisor_agent(llm: ChatOllama):
    async def advisor_agent(state: CopilotState) -> dict:
        user_name = state["user"].get("full_name", "there")
        system = SystemMessage(content=(
            f"You are a friendly financial advisor. User: {user_name}\n\n"
            f"Their financial context:\n{state['financial_context']}\n\n"
            "Give personalized financial advice based on their actual data. Be helpful, specific, and encouraging.\n\n"
            "IMPORTANT: Connect spending to goals. If the user has active goals with [need ₹X/month] shown, "
            "compare this against their current month expenses. If their discretionary spending exceeds what they "
            "should be saving toward goals, point this out constructively. Use get_goal_spending_impact tool if "
            "you need detailed goal vs spending analysis."
        ))
        history = dicts_to_langchain(state["messages"][-5:])
        response = await llm.ainvoke([system] + history)
        return {"final_response": state.get("final_response", "") + response.content, "next_node": "response_emitter"}
    return advisor_agent
