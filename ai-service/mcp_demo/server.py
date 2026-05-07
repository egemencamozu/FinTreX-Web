from __future__ import annotations

from typing import Literal

from mcp.server.fastmcp import FastMCP


mcp = FastMCP(
    "FinTreX MCP Server",
    instructions=(
        "Expose FinTreX portfolio-analysis context through MCP resources "
        "and read-only tools."
    ),
)


@mcp.resource("fintrex://mcp/overview")
def fintrex_mcp_overview() -> str:
    """Return a short description of the FinTreX MCP context."""
    return (
        "FinTreX MCP exposes portfolio analysis tools through the Model "
        "Context Protocol. The client can discover tools, read this resource, "
        "call risk and market-context tools, and render the process step by step."
    )


@mcp.tool()
def calculate_portfolio_risk(
    cash_try: float,
    stock_try: float,
    crypto_try: float,
    gold_try: float,
) -> dict:
    """Calculate a simple FinTreX portfolio risk summary from TRY values."""
    values = {
        "cash": max(cash_try, 0),
        "stock": max(stock_try, 0),
        "crypto": max(crypto_try, 0),
        "gold": max(gold_try, 0),
    }
    total = round(sum(values.values()), 2)

    if total <= 0:
        return {
            "total_try": 0,
            "allocation_percent": {key: 0 for key in values},
            "risk_score": 0,
            "risk_level": "none",
            "largest_asset": None,
            "concentration_warning": "No portfolio value was provided.",
        }

    allocation = {
        key: round((amount / total) * 100, 2)
        for key, amount in values.items()
    }

    risk_weights = {
        "cash": 0.10,
        "gold": 0.35,
        "stock": 0.60,
        "crypto": 0.90,
    }
    weighted_score = sum(allocation[key] * risk_weights[key] for key in values)
    largest_asset = max(allocation, key=allocation.get)
    concentration_penalty = max(allocation.values()) * 0.18
    risk_score = round(min(100, weighted_score + concentration_penalty), 2)

    if risk_score < 35:
        risk_level: Literal["low", "medium", "high"] = "low"
    elif risk_score < 65:
        risk_level = "medium"
    else:
        risk_level = "high"

    largest_percent = allocation[largest_asset]
    if largest_percent >= 60:
        warning = f"{largest_asset} allocation is concentrated at {largest_percent}%."
    elif largest_percent >= 45:
        warning = f"{largest_asset} is the largest allocation at {largest_percent}%."
    else:
        warning = "No single asset class dominates the portfolio."

    return {
        "total_try": total,
        "allocation_percent": allocation,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "largest_asset": largest_asset,
        "concentration_warning": warning,
    }


@mcp.tool()
def simulate_market_context(symbol: str = "BIST100") -> dict:
    """Return deterministic market context for a symbol."""
    normalized = symbol.strip().upper() or "BIST100"
    fixtures = {
        "BIST100": {
            "trend": "neutral-positive",
            "daily_change_percent": 0.84,
            "volatility": "medium",
        },
        "BTC": {
            "trend": "positive",
            "daily_change_percent": 2.35,
            "volatility": "high",
        },
        "XAU": {
            "trend": "defensive-positive",
            "daily_change_percent": 0.42,
            "volatility": "low-medium",
        },
    }
    context = fixtures.get(
        normalized,
        {
            "trend": "neutral",
            "daily_change_percent": 0.0,
            "volatility": "unknown",
        },
    )

    return {
        "symbol": normalized,
        **context,
        "source": "FinTreX MCP fixture",
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
