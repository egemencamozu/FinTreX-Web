"""
Safety validators for PAA microservice.
Ensures strict compliance with business rules:
1. ASLA yatırım tavsiyesi verme
2. ASLA yönlendirme yapma
3. Sadece VERİYE DAYALI gözlemler

These validators run AFTER LLM output to catch any violations.
"""

import re
import json
from typing import Optional


class ReportValidator:
    """Validates PAA-generated reports for compliance with safety rules."""

    # Forbidden words that indicate investment advice
    FORBIDDEN_PATTERNS = [
        r'\b(satın|al|sat|sat)\b',  # Turkish buy/sell
        r'\b(recommend|tavsiye)\b',  # English/Turkish recommend
        r'\b(should|yapmalısın)\b',  # Should do something
        r'\b(must\s+(?:buy|sell)|mutlaka|kesinlikle)',  # Strong directives
        r'\bforsage\b|\bgirişim\b',  # "Venture into" type language
        r'\bgüçlü\s+al\b',  # "Strong buy"
        r'\bzayıf\s+sat\b',  # "Weak sell"
    ]

    @staticmethod
    def is_investment_advice(text: str) -> bool:
        """
        Checks if text contains investment advice patterns.
        Returns True if violations found.
        """
        if not text:
            return False

        text_lower = text.lower()
        for pattern in ReportValidator.FORBIDDEN_PATTERNS:
            if re.search(pattern, text_lower):
                return True
        return False

    @staticmethod
    def validate_report(summary: str, outlook: str, findings: list) -> Optional[str]:
        """
        Validates entire report. Returns error message if violations found, None if clean.
        """
        # Check summary
        if ReportValidator.is_investment_advice(summary):
            return "Summary contains investment advice"

        # Check market outlook
        if ReportValidator.is_investment_advice(outlook):
            return "Market outlook contains investment advice"

        # Check key findings
        for finding in findings:
            if ReportValidator.is_investment_advice(finding):
                return f"Key finding contains investment advice: {finding}"

        return None

    @staticmethod
    def sanitize_report(summary: str, outlook: str, findings: list) -> tuple:
        """
        Attempts to remove common advice phrases (defensive measure).
        Note: This is secondary to LLM prompt enforcement.
        """
        def clean_text(text: str) -> str:
            # Replace "recommend" → "observation"
            text = re.sub(r'\btavsiye\s+ed', 'gözlem', text, flags=re.IGNORECASE)
            # Replace "should" → "may"
            text = re.sub(r'\byapmalısınız\b', 'yapabilirsiniz', text, flags=re.IGNORECASE)
            return text

        return (
            clean_text(summary),
            clean_text(outlook),
            [clean_text(f) for f in findings]
        )


class PortfolioValidator:
    """Validates input portfolio data."""

    @staticmethod
    def validate_portfolios(portfolios: list) -> Optional[str]:
        """
        Validates portfolio structure (supports both Pydantic models and dicts).
        Returns error message if invalid.
        """
        if not portfolios:
            return "No portfolios provided"

        for p in portfolios:
            # Support both Pydantic model objects and plain dicts
            assets = p.assets if hasattr(p, "assets") else p.get("assets", [])
            pid = p.portfolio_id if hasattr(p, "portfolio_id") else p.get("portfolio_id")

            if not isinstance(assets, list):
                return f"Portfolio {pid} has invalid assets structure"

            for asset in assets:
                symbol = asset.symbol if hasattr(asset, "symbol") else asset.get("symbol")
                qty = asset.quantity if hasattr(asset, "quantity") else asset.get("quantity")

                if qty is None or not isinstance(qty, (int, float)) or qty <= 0:
                    return f"Asset {symbol} has invalid quantity"

        return None

    @staticmethod
    def calculate_basic_metrics(portfolios: list) -> dict:
        """
        Pre-calculates basic metrics (supports both Pydantic models and dicts).
        """
        total_assets = 0
        asset_types = set()
        currencies = set()
        total_cost_basis = 0.0

        for p in portfolios:
            assets = p.assets if hasattr(p, "assets") else p.get("assets", [])
            for asset in assets:
                total_assets += 1
                atype = asset.asset_type if hasattr(asset, "asset_type") else asset.get("asset_type", "")
                cur = asset.currency if hasattr(asset, "currency") else asset.get("currency", "")
                qty = asset.quantity if hasattr(asset, "quantity") else asset.get("quantity", 0)
                cost = asset.average_cost if hasattr(asset, "average_cost") else asset.get("average_cost", 0)
                asset_types.add(atype)
                currencies.add(cur)
                total_cost_basis += qty * cost

        return {
            "total_assets": total_assets,
            "asset_types": list(asset_types),
            "currencies": list(currencies),
            "total_cost_basis": total_cost_basis,
        }
