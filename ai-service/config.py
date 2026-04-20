import os
from dotenv import load_dotenv

load_dotenv()

FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8500"))
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# CrewAI/LiteLLM often expects 'openai/' prefix
if not MODEL_NAME.startswith("openai/"):
    LITELLM_MODEL = f"openai/{MODEL_NAME}"
else:
    LITELLM_MODEL = MODEL_NAME

def get_llm():
    """Return the LLM instance for CrewAI agents."""
    from crewai import LLM

    # Explicitly set env for litellm
    if OPENAI_API_KEY:
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
    
    return LLM(
        model=LITELLM_MODEL,
        temperature=0.3,
        api_key=OPENAI_API_KEY
    )

# ===== LangGraph AI Assistant Config =====
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
LANGGRAPH_MODEL_NAME = os.getenv("LANGGRAPH_MODEL_NAME", MODEL_NAME)
GUARDRAIL_MAX_RETRY = int(os.getenv("GUARDRAIL_MAX_RETRY", "2"))
BACKEND_API_TIMEOUT = float(os.getenv("BACKEND_API_TIMEOUT", "30.0"))
MAX_CONVERSATION_HISTORY = int(os.getenv("MAX_CONVERSATION_HISTORY", "20"))

def get_langgraph_llm(streaming: bool = False):
    """LangChain/LangGraph için ChatOpenAI instance."""
    from langchain_openai import ChatOpenAI
    
    # Explicitly set env for litellm
    if OPENAI_API_KEY:
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
        
    return ChatOpenAI(
        model=LANGGRAPH_MODEL_NAME.replace("openai/", ""),
        temperature=0.3,
        api_key=OPENAI_API_KEY,
        streaming=streaming,
    )
