import asyncio
import logging
from typing import Dict, Any, List
from langgraph_assistant.state import AssistantState
from langgraph_assistant.tools.portfolio_tools import PORTFOLIO_TOOLS
from langgraph_assistant.tools.market_data_tools import MARKET_DATA_TOOLS
from langgraph_assistant.tools.calculation_tools import CALCULATION_TOOLS
from config import BACKEND_API_URL

logger = logging.getLogger(__name__)

# Registry for tool lookup by name
all_tools_list = PORTFOLIO_TOOLS + MARKET_DATA_TOOLS + CALCULATION_TOOLS
TOOL_REGISTRY = {t.name: t for t in all_tools_list}

async def tool_executor_node(state: AssistantState) -> AssistantState:
    """
    Executes the tools identified by the router. 
    Handles parallel execution and error reporting.
    """
    tool_calls = state.get("tool_calls", [])
    if not tool_calls:
        return {}

    # Context to be injected into tools
    context = {
        "backend_api_url": state.get("backend_api_url") or BACKEND_API_URL,
        "auth_token": state.get("auth_token"),
        "user_role": state.get("user_role"),
        "client_id": state.get("client_id")
    }

    tasks = []
    tool_names = []

    for call in tool_calls:
        name = call.get("name")
        args = call.get("args", {})
        
        tool_func = TOOL_REGISTRY.get(name)
        if not tool_func:
            logger.warning(f"Router requested unknown tool: {name}")
            continue

        tool_names.append(name)
        # Check if tool takes 'context'
        # All our current tools take 'context' as a keyword argument
        # We merge provided args from LLM with our internal context
        call_args = {**args, "context": context}
        tasks.append(tool_func.ainvoke(call_args))

    if not tasks:
        return {}

    # Execute tools in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)

    tool_results = state.get("tool_results", {})
    tool_errors = state.get("tool_errors", {})
    
    success_count = 0
    fail_count = 0

    for name, result in zip(tool_names, results):
        if isinstance(result, Exception):
            logger.error(f"Tool {name} crashed: {str(result)}")
            tool_errors[name] = str(result)
            fail_count += 1
        elif isinstance(result, dict) and result.get("_tool_failed"):
            logger.warning(f"Tool {name} failed: {result.get('error')}")
            tool_errors[name] = result.get("error", "Unknown error")
            fail_count += 1
        else:
            tool_results[name] = result
            success_count += 1

    partial_data = success_count > 0 and fail_count > 0

    return {
        "tool_results": tool_results,
        "tool_errors": tool_errors,
        "partial_data": partial_data
    }
