from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


DEFAULT_PORTFOLIO = {
    "cash_try": 65000,
    "stock_try": 215000,
    "crypto_try": 45000,
    "gold_try": 85000,
    "symbol": "BIST100",
}


def _json_or_text(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _extract_content(content_items: list[Any]) -> Any:
    extracted: list[Any] = []
    for item in content_items:
        text = getattr(item, "text", None)
        if text is not None:
            extracted.append(_json_or_text(text))
            continue

        if isinstance(item, dict) and "text" in item:
            extracted.append(_json_or_text(str(item["text"])))
            continue

        extracted.append(str(item))

    if len(extracted) == 1:
        return extracted[0]
    return extracted


def _normalize_tool(tool: Any) -> dict[str, Any]:
    return {
        "name": getattr(tool, "name", ""),
        "description": getattr(tool, "description", "") or "",
        "input_schema": getattr(tool, "inputSchema", None) or getattr(tool, "input_schema", None),
    }


def _normalize_resource(result: Any, uri: str) -> dict[str, Any]:
    contents = getattr(result, "contents", [])
    if not contents:
        return {"uri": uri, "content": None}

    first = contents[0]
    return {
        "uri": str(getattr(first, "uri", uri)),
        "mime_type": getattr(first, "mimeType", None),
        "content": getattr(first, "text", str(first)),
    }


async def run_mcp_demo(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run the FinTreX MCP flow through a real stdio MCP client session."""
    input_context = {**DEFAULT_PORTFOLIO, **(payload or {})}
    server_path = Path(__file__).with_name("server.py")
    process_steps: list[dict[str, Any]] = []

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[str(server_path)],
    )

    process_steps.append(
        {
            "name": "Start MCP server",
            "status": "completed",
            "detail": "FastAPI launches the FinTreX MCP server over stdio.",
        }
    )

    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            init_result = await session.initialize()
            server_info = getattr(init_result, "serverInfo", None)
            process_steps.append(
                {
                    "name": "Initialize session",
                    "status": "completed",
                    "detail": "Client and server negotiated MCP capabilities.",
                }
            )

            tools_result = await session.list_tools()
            tools = [_normalize_tool(tool) for tool in getattr(tools_result, "tools", [])]
            process_steps.append(
                {
                    "name": "Discover tools",
                    "status": "completed",
                    "detail": f"{len(tools)} tools discovered with tools/list.",
                }
            )

            resource_uri = "fintrex://mcp/overview"
            resource_result = await session.read_resource(resource_uri)
            resource = _normalize_resource(resource_result, resource_uri)
            process_steps.append(
                {
                    "name": "Read resource",
                    "status": "completed",
                    "detail": f"Read project context from {resource_uri}.",
                }
            )

            risk_result = await session.call_tool(
                "calculate_portfolio_risk",
                {
                    "cash_try": float(input_context["cash_try"]),
                    "stock_try": float(input_context["stock_try"]),
                    "crypto_try": float(input_context["crypto_try"]),
                    "gold_try": float(input_context["gold_try"]),
                },
            )
            portfolio_risk = _extract_content(getattr(risk_result, "content", []))
            process_steps.append(
                {
                    "name": "Call calculate_portfolio_risk",
                    "status": "completed",
                    "detail": "Portfolio values were sent as structured MCP tool arguments.",
                }
            )

            market_result = await session.call_tool(
                "simulate_market_context",
                {"symbol": str(input_context["symbol"])},
            )
            market_context = _extract_content(getattr(market_result, "content", []))
            process_steps.append(
                {
                    "name": "Call simulate_market_context",
                    "status": "completed",
                    "detail": "A market snapshot was returned through the same protocol.",
                }
            )

            process_steps.append(
                {
                    "name": "Return MCP response",
                    "status": "completed",
                    "detail": "FastAPI returns the MCP process and results to Angular.",
                }
            )

            return {
                "status": "success",
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "input_context": input_context,
                "handshake": {
                    "protocol_version": getattr(init_result, "protocolVersion", None),
                    "server_name": getattr(server_info, "name", "FinTreX MCP Server"),
                    "server_version": getattr(server_info, "version", None),
                },
                "process": process_steps,
                "discovered_tools": tools,
                "resource": resource,
                "tool_results": {
                    "portfolio_risk": portfolio_risk,
                    "market_context": market_context,
                },
            }
