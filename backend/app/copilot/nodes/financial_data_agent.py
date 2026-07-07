import json
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_ollama import ChatOllama
from sqlalchemy.ext.asyncio import AsyncSession
from app.copilot.state import CopilotState
from app.copilot.agents.base import create_tools, dicts_to_langchain


def make_financial_data_agent(db: AsyncSession, user, llm: ChatOllama):
    async def financial_data_agent(state: CopilotState) -> dict:
        tools = create_tools(db, state["user_id"], user)
        llm_with_tools = llm.bind_tools(tools)
        tool_map = {t.name: t for t in tools}

        system = SystemMessage(content=(
            f"You are a financial data assistant. The user's name is {state['user'].get('full_name', 'there')}.\n\n"
            f"Financial context:\n{state['financial_context']}\n\n"
            "CRITICAL: You MUST use a tool to answer ANY question about spending, income, transactions, "
            "budgets, or other financial data. Do NOT answer from the summary context alone.\n"
            "Always prefer using a tool over guessing from context."
        ))
        history = dicts_to_langchain(state["messages"][-5:])
        agent_messages = [system] + history
        scratchpad = []

        ai_msg = await llm_with_tools.ainvoke(agent_messages)
        iterations = 0
        while ai_msg.tool_calls and iterations < 3:
            scratchpad.append(ai_msg)
            for tc in ai_msg.tool_calls:
                fn = tool_map.get(tc["name"])
                if fn:
                    try:
                        result = await fn.ainvoke(tc["args"])
                    except Exception as e:
                        result = json.dumps({"error": str(e)})
                else:
                    result = json.dumps({"error": f"Unknown tool: {tc['name']}"})
                scratchpad.append(ToolMessage(content=result, tool_call_id=tc["id"]))
            ai_msg = await llm_with_tools.ainvoke(agent_messages + scratchpad)
            iterations += 1

        scratchpad.append(ai_msg)
        final = ai_msg.content or "I found the information you requested."
        return {"final_response": state.get("final_response", "") + final, "agent_scratchpad": scratchpad, "next_node": "response_emitter"}
    return financial_data_agent
