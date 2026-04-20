from langgraph.graph import StateGraph, START, END
from langgraph_assistant.state import AssistantState
from langgraph_assistant.nodes.router import router_node
from langgraph_assistant.nodes.tool_executor import tool_executor_node
from langgraph_assistant.nodes.synthesizer import synthesizer_node
from langgraph_assistant.nodes.guardrail import guardrail_node

def route_after_router(state: AssistantState) -> str:
    """Decides whether to go to tool execution or direct answer after router."""
    if state.get("tool_calls"):
        return "tool_executor"
    return "synthesizer"

def route_after_guardrail(state: AssistantState) -> str:
    """Decides whether to finish or retry after guardrail check."""
    if state.get("guardrail_passed"):
        return END
    
    # If not passed, return to synthesizer. Guardrail node itself 
    # handles the max retry limit and forces guardrail_passed=True if needed.
    return "synthesizer"

def build_graph():
    """Assembles the LangGraph state machine."""
    workflow = StateGraph(AssistantState)

    # 1. Add Nodes
    workflow.add_node("router", router_node)
    workflow.add_node("tool_executor", tool_executor_node)
    workflow.add_node("synthesizer", synthesizer_node)
    workflow.add_node("guardrail", guardrail_node)

    # 2. Add Edges
    workflow.add_edge(START, "router")

    # Routing from router
    workflow.add_conditional_edges(
        "router",
        route_after_router,
        {
            "tool_executor": "tool_executor",
            "synthesizer": "synthesizer"
        }
    )

    # From tool executor back to synthesizer
    workflow.add_edge("tool_executor", "synthesizer")

    # Synthesizer always goes to guardrail
    workflow.add_edge("synthesizer", "guardrail")

    # Routing from guardrail (retry loop)
    workflow.add_conditional_edges(
        "guardrail",
        route_after_guardrail,
        {
            "synthesizer": "synthesizer",
            END: END
        }
    )

    return workflow.compile()

# Singleton instance for the application
compiled_graph = build_graph()
