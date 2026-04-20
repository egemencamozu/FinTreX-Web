from typing import Optional, List, Dict, Literal
from pydantic import BaseModel, Field, field_validator

class AiChatContext(BaseModel):
    client_id: Optional[str] = None

class AiChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., description="Kullanıcı mesajı")
    user_id: str
    user_role: Literal["USER", "ECONOMIST"]
    auth_token: str
    context: Optional[AiChatContext] = None
    conversation_history: Optional[List[Dict[str, str]]] = None

    @field_validator('message')
    @classmethod
    def validate_message(cls, v: str) -> str:
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Message cannot be empty or just whitespace.")
        if len(v) > 4000:
            raise ValueError("Message cannot be longer than 4000 characters.")
        return v

class AiChatResponse(BaseModel):
    conversation_id: str
    message: str
    tools_used: List[str]
    is_successful: bool
    error_message: Optional[str] = None
    partial_data: bool = False

# SSE Event Models
class SSETokenEvent(BaseModel):
    type: Literal["token"] = "token"
    content: str

class SSEToolStartEvent(BaseModel):
    type: Literal["tool_start"] = "tool_start"
    tool: str

class SSEToolEndEvent(BaseModel):
    type: Literal["tool_end"] = "tool_end"
    tool: str
    success: bool

class SSEDoneEvent(BaseModel):
    type: Literal["done"] = "done"
    conversation_id: str
    tools_used: List[str]
    partial_data: bool

class SSEErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str

class SSEGuardrailOverrideEvent(BaseModel):
    type: Literal["guardrail_override"] = "guardrail_override"
    message: str
