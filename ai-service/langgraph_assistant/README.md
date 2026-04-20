# FinTreX LangGraph AI Portfolio Assistant

Core Engine module providing an interactive, conversational AI agent for user portfolios.

## Setup
Dependencies are already included in `ai-service/requirements.txt`.
Ensure `.env` contains the required LangGraph variables:
```
BACKEND_API_URL=http://localhost:5000
LANGGRAPH_MODEL_NAME=gpt-4o-mini
GUARDRAIL_MAX_RETRY=2
BACKEND_API_TIMEOUT=30.0
MAX_CONVERSATION_HISTORY=20
```

## Endpoints
- `POST /ai-chat` : Standard non-streaming chat. Response is JSON.
- `POST /ai-chat/stream` : Streaming Server-Sent Events (SSE) chat.

## Tools
The graph runs with a variety of specialized tools:
- **Portfolio Tools**: `get_user_portfolios`, `get_portfolio_detail`, `get_client_portfolios`
- **Market Data Tools**: `get_stock_prices`, `get_stock_price`, `get_crypto_prices`, `get_gold_prices`, `get_forex_rates`
- **Calculation Tools**: `calculate_portfolio_distribution`, `calculate_total_value`, `calculate_profit_loss`

## Guardrails
The agent is prohibited from giving investment advice. A guardrail node recursively checks the generated response. If a violation is detected up to `GUARDRAIL_MAX_RETRY` times, it will force a fallback "safe" response.

## Integration (Phase 2)
The .NET backend is responsible for:
- Maintaining conversation history in DB.
- Extracting `user_id` and forwarding JWT logic to ensure tools read context properly.
- Providing concurrency control (DB level flag) to prevent overlaps.
