from typing import TypedDict, List, Dict, Any, Optional

class AssistantState(TypedDict, total=False):
    # Conversation
    messages: List[Dict[str, str]]      # [{"role": "user"/"assistant", "content": "..."}]
    conversation_id: str
    user_id: str
    user_role: str                       # "USER" | "ECONOMIST"
    current_user_message: str            # En son gelen kullanıcı mesajı

    # Tool Execution
    tool_calls: List[Dict[str, Any]]     # [{"name": "tool_name", "args": {...}}]
    tool_results: Dict[str, Any]         # {"tool_name": {...result...}}
    tool_errors: Dict[str, str]          # {"tool_name": "error message"}
    partial_data: bool                   # En az 1 tool başarısız ama diğerleri OK

    # Response
    draft_response: str
    final_response: str
    guardrail_passed: bool
    guardrail_retry_count: int

    # Context
    backend_api_url: str
    auth_token: str
    client_id: Optional[str]             # ECONOMIST ise müşteri ID
