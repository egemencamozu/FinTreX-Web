# FinTreX MCP Implementation Report

## Goal

This implementation demonstrates MCP (Model Context Protocol) inside FinTreX. The demo shows how an AI client can connect to a FinTreX MCP server, discover available tools, read project context, call tools with structured arguments, and display structured results.

## What Was Added

- MCP server: `ai-service/mcp_demo/server.py`
- MCP client runner: `ai-service/mcp_demo/client.py`
- FastAPI demo endpoints:
  - `GET /mcp/health`
  - `GET /mcp/demo`
  - `POST /mcp/demo`
- Angular demo page:
  - `/mcp-demo`
  - `frontend/src/app/presentation/features/mcp-demo/pages/mcp-demo/`
- New dependency:
  - `mcp>=1.26.0`

## How MCP Works In This Project

1. The FastAPI endpoint starts the MCP server through stdio.
2. The MCP client initializes a session and negotiates protocol capabilities.
3. The client asks the server for available tools with `tools/list`.
4. The client reads the resource `fintrex://mcp/overview`.
5. The client calls `calculate_portfolio_risk` with portfolio values.
6. The client calls `simulate_market_context` for a market snapshot.
7. FastAPI returns the full process and results to the Angular page.

## Demo Tools

### `calculate_portfolio_risk`

Receives TRY-denominated portfolio amounts:

- `cash_try`
- `stock_try`
- `crypto_try`
- `gold_try`

Returns:

- total portfolio value
- allocation percentages
- risk score
- risk level
- largest asset group
- concentration warning

### `simulate_market_context`

Receives a symbol such as `BIST100`, `BTC`, or `XAU`.

Returns:

- symbol
- trend
- daily change percent
- volatility
- data source label

## Demo Steps

1. Start the AI service:

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8500
```

2. Start the frontend:

```bash
cd frontend
npm run start
```

3. Open:

```text
http://localhost:4200/mcp-demo
```

4. Change portfolio inputs and click `Run Demo`.

## Why This Shows MCP Clearly

The page displays the MCP process as visible steps: initialization, tool discovery, resource reading, tool call, and final result. This makes the protocol behavior observable instead of hiding it behind a single AI answer.

