from pydantic import BaseModel
from typing import Optional


class PortfolioAssetInput(BaseModel):
    symbol: str
    asset_name: str
    asset_type: str          # "BIST", "Crypto", "PreciousMetal"
    quantity: float
    average_cost: float
    currency: str            # "TRY", "USD", "EUR"
    current_value: Optional[float] = None
    notes: Optional[str] = None


class PortfolioInput(BaseModel):
    portfolio_id: int
    name: str
    description: Optional[str] = None
    assets: list[PortfolioAssetInput] = []
    sub_portfolios: list["PortfolioInput"] = []


PortfolioInput.model_rebuild()


class AnalyzeRequest(BaseModel):
    task_id: int
    task_title: str
    task_description: str
    task_category: str       # "PortfolioAnalysis", "RiskAssessment", vb.
    user_portfolios: list[PortfolioInput]


class AnalyzeResponse(BaseModel):
    task_id: int
    summary: str
    risk_level: str          # "Low", "Medium", "High"
    market_outlook: str
    key_findings: str        # JSON array string
    raw_content: str
    is_successful: bool
    error_message: Optional[str] = None
    generated_at_utc: str
