import json
import logging
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph_assistant.state import AssistantState
from langgraph_assistant.prompts.router_prompt import ROUTER_PROMPT
from langgraph_assistant.tools.portfolio_tools import PORTFOLIO_TOOLS
from langgraph_assistant.tools.market_data_tools import MARKET_DATA_TOOLS
from langgraph_assistant.tools.calculation_tools import CALCULATION_TOOLS
from config import get_langgraph_llm

logger = logging.getLogger(__name__)

# Combine all tools for description injection
ALL_TOOLS = PORTFOLIO_TOOLS + MARKET_DATA_TOOLS + CALCULATION_TOOLS

def get_tools_description() -> str:
    """Generates a text description of all available tools for the prompt."""
    descriptions = []
    for tool in ALL_TOOLS:
        descriptions.append(f"- {tool.name}: {tool.description}")
    return "\n".join(descriptions)

async def router_node(state: AssistantState) -> AssistantState:
    """
    Analyzes the user's message and decides which tools (if any) to call.
    """
    try:
        # 1. Prepare messages for LLM
        tools_list_str = get_tools_description()
        
        # Inject Economist context if applicable
        user_msg = state.get("current_user_message", "")
        if state.get("user_role") == "ECONOMIST" and state.get("client_id"):
            user_msg = f"[MÜŞTERİ ID: {state.get('client_id')}] - {user_msg}"
            
        full_prompt = ROUTER_PROMPT.format(
            tools_descriptions=tools_list_str,
            user_message=user_msg
        )
        
        messages = [
            SystemMessage(content=full_prompt),
        ]
        
        # Add conversation history if available
        for msg in state.get("messages", []):
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg.get("content")))
            elif msg.get("role") == "assistant":
                # We could use AIMessage here, but for simplicity:
                from langchain_core.messages import AIMessage
                messages.append(AIMessage(content=msg.get("content")))

        # 2. Call LLM
        llm = get_langgraph_llm(streaming=False).bind(
            response_format={"type": "json_object"}
        )
        
        response = await llm.ainvoke(messages)
        
        # 3. Parse result
        try:
            parsed = json.loads(response.content)
            tool_calls = parsed.get("tools", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse router output: {response.content}")
            tool_calls = []
            
        # 4. Update state
        return {
            "tool_calls": tool_calls
        }
        
    except Exception as e:
        logger.error(f"Error in router_node: {str(e)}")
        return {
            "tool_calls": []
        }
