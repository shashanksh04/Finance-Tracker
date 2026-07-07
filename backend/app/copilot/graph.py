from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_ollama import ChatOllama
from app.copilot.state import CopilotState
from app.copilot.nodes import (
    make_input_parser, make_context_builder, make_router,
    make_supervisor, make_financial_data_agent, make_analysis_agent,
    make_advisor_agent, make_response_emitter,
)


def build_copilot_graph(db: AsyncSession, user, llm: ChatOllama):
    builder = StateGraph(CopilotState)

    builder.add_node("input_parser", make_input_parser())
    builder.add_node("context_builder", make_context_builder(db, user))
    builder.add_node("router", make_router())
    builder.add_node("supervisor", make_supervisor(llm))
    builder.add_node("financial_data", make_financial_data_agent(db, user, llm))
    builder.add_node("analysis", make_analysis_agent(db, user, llm))
    builder.add_node("advisor", make_advisor_agent(llm))
    builder.add_node("response_emitter", make_response_emitter(db, user))

    builder.add_conditional_edges(
        "router",
        lambda state: "financial_data" if state.get("is_fast_path") else "supervisor",
        {"financial_data": "financial_data", "supervisor": "supervisor"},
    )

    builder.add_conditional_edges(
        "supervisor",
        lambda state: state.get("next_node", "advisor"),
        {
            "financial_data": "financial_data",
            "analysis": "analysis",
            "advisor": "advisor",
            "response_emitter": "response_emitter",
        },
    )

    builder.add_edge("financial_data", "response_emitter")
    builder.add_edge("analysis", "response_emitter")
    builder.add_edge("advisor", "response_emitter")

    builder.set_entry_point("input_parser")
    builder.add_edge("input_parser", "context_builder")
    builder.add_edge("context_builder", "router")
    builder.add_edge("response_emitter", END)

    return builder.compile()
