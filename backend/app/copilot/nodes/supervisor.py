from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel, Field
from langchain_ollama import ChatOllama
from app.copilot.state import CopilotState


class SupervisorPlan(BaseModel):
    next_node: str = Field(..., description="The agent to invoke next")
    reasoning: str = Field(..., description="Why this agent was chosen")
    requires_tools: bool = Field(..., description="Whether the agent needs tools")


def make_supervisor(llm: ChatOllama):
    async def supervisor(state: CopilotState) -> dict:
        user_name = state["user"].get("full_name", "there")
        prompt = [
            SystemMessage(content=(
                f"You are a financial copilot supervisor. User: {user_name}\n\n"
                f"Financial context:\n{state['financial_context']}\n\n"
                "Available agents:\n"
                "- financial_data: Has 8 tools (accounts, transactions, budgets, goals, bills, spending, income). "
                "Use for data queries like 'how much did I spend on food' or 'show my accounts'.\n"
                "- analysis: Deep period analysis, trends, comparisons. Use for 'compare this month to last' or trends.\n"
                "- advisor: Pure conversational financial advice, no tools. "
                "Use for general chat, greetings, or advice like 'how can I save more'.\n"
                "- response_emitter: Final formatter. Only if the query needs no data or advice "
                "(e.g. just 'hello' or 'thanks').\n\n"
                "Choose the single best agent for the user's request."
            )),
            HumanMessage(content=state["message"]),
        ]
        try:
            llm_structured = llm.with_structured_output(SupervisorPlan)
            plan = await llm_structured.ainvoke(prompt)
            return {"next_node": plan.next_node, "plan": [plan.next_node]}
        except Exception:
            return {"next_node": "advisor", "errors": ["Supervisor routing failed, defaulting to advisor"]}
    return supervisor
