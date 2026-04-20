import logging
import re
from langgraph_assistant.state import AssistantState
from validators import ReportValidator
from config import GUARDRAIL_MAX_RETRY

logger = logging.getLogger(__name__)

# Additional patterns specific to chat context that might not be in the base validator
EXTRA_FORBIDDEN_PATTERNS = [
    r'\byatırım\s+yapmanızı\b',
    r'\bportföyünüze\s+eklemenizi\b',
    r'\bsatmanızı\s+öneririm\b',
    r'\balmanızı\s+öneririm\b',
    r'\btutmanızı\s+öneririm\b',
    r'\bçıkarmanızı\b',
    r'\bdeğerlendirin\b',
    r'\bal\s+fırsatı\b',
    r'\bsat\s+sinyali\b'
]

def guardrail_node(state: AssistantState) -> AssistantState:
    """
    Checks the draft response for investment advice or forbidden patterns.
    Triggers a retry loop (back to synthesizer) if advice is detected.
    """
    draft = state.get("draft_response", "")
    if not draft:
        return {"guardrail_passed": True, "final_response": ""}

    # 1. Check using base validator
    is_advice = ReportValidator.is_investment_advice(draft)

    # 2. Check using extra patterns
    if not is_advice:
        draft_lower = draft.lower()
        for pattern in EXTRA_FORBIDDEN_PATTERNS:
            if re.search(pattern, draft_lower):
                is_advice = True
                logger.warning(f"Guardrail hit extra pattern: {pattern}")
                break

    # 3. Handle Decision
    retry_count = state.get("guardrail_retry_count", 0)

    if not is_advice:
        # PASS
        return {
            "guardrail_passed": True,
            "final_response": draft
        }
    else:
        # FAIL
        new_retry_count = retry_count + 1
        logger.warning(f"Guardrail FAIL (retry {new_retry_count}/{GUARDRAIL_MAX_RETRY})")

        if new_retry_count >= GUARDRAIL_MAX_RETRY:
            # Max retries reached, use safe fallback
            safe_response = (
                "Bu konuda yatırım tavsiyesi veremem. FinTreX kuralları gereği sadece mevcut portföy verilerinize "
                "ve piyasa rakamlarına dayalı gözlemler sunabilirim. Lütfen stratejik kararlarınız için "
                "bir finansal danışmana danışın."
            )
            return {
                "guardrail_passed": True, # Move to END
                "final_response": safe_response,
                "guardrail_retry_count": new_retry_count
            }
        else:
            # Trigger retry (go back to synthesizer)
            return {
                "guardrail_passed": False,
                "guardrail_retry_count": new_retry_count
            }
