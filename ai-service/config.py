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
