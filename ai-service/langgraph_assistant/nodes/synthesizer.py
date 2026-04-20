import json
import logging
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph_assistant.state import AssistantState
from langgraph_assistant.prompts.system_prompt import build_system_prompt, SYNTHESIZER_INSTRUCTIONS
from config import get_langgraph_llm

logger = logging.getLogger(__name__)

async def synthesizer_node(state: AssistantState) -> AssistantState:
    """
    Synthesizes a natural language response based on tool results, 
    conversation history, and any tool errors.
    """
    try:
        # 1. Prepare messages
        has_client = bool(state.get("client_id"))
        system_base = build_system_prompt(state.get("user_role", "USER"), has_client)
        
        # Add synthesizer specific instructions
        system_full = f"{system_base}\n\n{SYNTHESIZER_INSTRUCTIONS}"
        
        # Handle guardrail retry context
        retry_count = state.get("guardrail_retry_count", 0)
        if retry_count > 0:
            system_full += "\n\n⚠️ ÖNEMLİ: Önceki cevabın yatırım tavsiyesi içerdiği için reddedildi. Lütfen cevabını tamamen OBJEKTİF GÖZLEMLERLE sınırla, kesinlikle öneri veya tavsiye verme."

        messages = [
            SystemMessage(content=system_full),
        ]

        # Add conversation history
        for msg in state.get("messages", []):
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg.get("content")))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg.get("content")))

        # Add tool data context
        tool_data_prompt = "\n\n=== VERİ KAYNAKLARI (Tool Sonuçları) ===\n"
        tool_results = state.get("tool_results", {})
        if tool_results:
            for name, result in tool_results.items():
                tool_data_prompt += f"\n- {name}: {json.dumps(result, ensure_ascii=False)}"
        else:
            tool_data_prompt += "\n(Veri çekilmedi veya veri bulunamadı)"

        tool_errors = state.get("tool_errors", {})
        if tool_errors:
            tool_data_prompt += "\n\n=== VERİ ERİŞİM HATALARI ===\n"
            for name, error in tool_errors.items():
                tool_data_prompt += f"\n- {name}: {error}"

        # Combine everything for the final user message in this turn
        user_message_with_data = f"{state.get('current_user_message', '')}\n\n{tool_data_prompt}"
        messages.append(HumanMessage(content=user_message_with_data))

        # 2. Call LLM
        # Use config helper. It internally configures API key and model.
        llm = get_langgraph_llm(streaming=True)
        
        response = await llm.ainvoke(messages)
        
        # 3. Update state
        return {
            "draft_response": response.content
        }

    except Exception as e:
        logger.error(f"Error in synthesizer_node: {str(e)}")
        return {
            "draft_response": "Üzgünüm, şu an cevap üretemiyorum. Lütfen daha sonra tekrar deneyin."
        }
