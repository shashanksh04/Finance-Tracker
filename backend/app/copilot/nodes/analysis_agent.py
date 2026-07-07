import json
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from sqlalchemy.ext.asyncio import AsyncSession
from app.copilot.state import CopilotState
from app.copilot.agents.base import dicts_to_langchain
from app.copilot.tools.finance_tools import compare_periods as _compare_periods
from app.services.analysis_service import AnalysisService


def make_analysis_agent(db: AsyncSession, user, llm: ChatOllama):
    async def analysis_agent(state: CopilotState) -> dict:
        _uid = state["user_id"]

        @tool
        async def analyze_period(period: str, year: int, month: int = None, quarter: int = None) -> str:
            """Get period analysis with income, expenses, trends, category breakdown."""
            svc = AnalysisService(db)
            result = await svc.get_period_analysis(_uid, period, year, month, quarter)
            return json.dumps(result, default=str)

        @tool
        async def compare_periods_tool(period_a: str, period_b: str, category: str = None) -> str:
            """Compare income/expenses between two periods."""
            result = await _compare_periods(db=db, user_id=_uid, user=user, period_a=period_a, period_b=period_b, category=category)
            return json.dumps(result, default=str)

        tools = [analyze_period, compare_periods_tool]
        llm_with_tools = llm.bind_tools(tools)

        system = SystemMessage(content=(
            "You are a financial analysis assistant. Use the available tools to perform deep analysis "
            "of the user's finances. Provide clear insights with numbers."
        ))
        history = dicts_to_langchain(state["messages"][-5:])
        agent_messages = [system] + history
        scratchpad = []

        ai_msg = await llm_with_tools.ainvoke(agent_messages)
        iterations = 0
        while ai_msg.tool_calls and iterations < 3:
            scratchpad.append(ai_msg)
            for tc in ai_msg.tool_calls:
                fn = analyze_period if tc["name"] == "analyze_period" else compare_periods_tool
                try:
                    result = await fn.ainvoke(tc["args"])
                except Exception as e:
                    result = json.dumps({"error": str(e)})
                scratchpad.append(ToolMessage(content=result, tool_call_id=tc["id"]))
            ai_msg = await llm_with_tools.ainvoke(agent_messages + scratchpad)
            iterations += 1

        scratchpad.append(ai_msg)
        final = ai_msg.content or "Analysis complete."
        return {"final_response": state.get("final_response", "") + final, "agent_scratchpad": scratchpad, "next_node": "response_emitter"}
    return analysis_agent
