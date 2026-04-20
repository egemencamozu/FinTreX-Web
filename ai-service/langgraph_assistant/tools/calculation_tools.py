from typing import List, Dict, Any, Optional
from langchain_core.tools import tool

@tool
async def calculate_portfolio_distribution(portfolios: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Portföydeki varlıkların tip bazında yüzdelik dağılımını hesaplar.
    Ne zaman kullanılır: Kullanıcı 'portföy dağılımım nasıl', 'hangi varlıktan ne kadar var' gibi sorular sorduğunda.
    Girdi: portfolios (list) - get_user_portfolios veya get_portfolio_detail'den dönen portföy verisi.
    """
    distribution = {}
    total_value = 0
    
    # Process assets across all portfolios
    for portfolio in portfolios:
        assets = portfolio.get("assets", [])
        for asset in assets:
            # We use current market value if available, otherwise cost basis
            # Based on backend DTO structure (assuming amount * price)
            amount = asset.get("amount", 0)
            price = asset.get("currentPrice") or asset.get("purchasePrice") or 0
            value = amount * price
            
            asset_type = asset.get("assetType", "Other")
            distribution[asset_type] = distribution.get(asset_type, 0) + value
            total_value += value
            
    if total_value == 0:
        return {"distribution": {}, "note": "Toplam değer 0 veya varlık bulunamadı."}
        
    # Convert absolute values to percentages
    result = {k: round((v / total_value) * 100, 2) for k, v in distribution.items()}
    return {
        "distribution": result,
        "total_value_basis": total_value,
        "unit": "Percentage"
    }

@tool
async def calculate_total_value(
    portfolios: List[Dict[str, Any]], 
    forex_rates: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Tüm portföylerin toplam değerini TRY ve USD bazında hesaplar.
    Ne zaman kullanılır: Kullanıcı 'toplam ne kadar param var', 'portföy değerim nedir' gibi sorular sorduğunda.
    Girdi: 
        - portfolios: Portföy listesi.
        - forex_rates: (Opsiyonel) get_forex_rates'den dönen kur bilgisi.
    """
    total_try = 0
    usd_rate = 1.0
    
    if forex_rates:
        # Assuming forex_rates is a list or dict of rates. 
        # Typically looks like {"USD": {"price": 32.5}, ...}
        rates = forex_rates.get("rates", forex_rates) # flexibility
        if isinstance(rates, list):
            for r in rates:
                if r.get("ticker") == "USDTRY":
                    usd_rate = r.get("price", 1.0)
        elif isinstance(rates, dict):
             # Try common keys
             usd_rate = rates.get("USDTRY", {}).get("price") or rates.get("USD", {}).get("price") or 1.0

    for portfolio in portfolios:
        assets = portfolio.get("assets", [])
        for asset in assets:
            amount = asset.get("amount", 0)
            price = asset.get("currentPrice") or asset.get("purchasePrice") or 0
            value = amount * price
            
            currency = asset.get("currency", "TRY")
            if currency == "USD":
                total_try += value * usd_rate
            else:
                total_try += value
                
    return {
        "total_try": round(total_try, 2),
        "total_usd": round(total_try / usd_rate, 2) if usd_rate > 0 else 0,
        "usd_rate_used": usd_rate
    }

@tool
async def calculate_profit_loss(portfolios: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Portföydeki varlıkların alış fiyatı ile güncel fiyatı arasındaki kâr/zarar durumunu hesaplar.
    Ne zaman kullanılır: Kullanıcı 'ne kadar kâr ettim', 'zararda mıyım' gibi sorular sorduğunda.
    """
    total_cost = 0
    total_value = 0
    details = []
    
    for portfolio in portfolios:
        assets = portfolio.get("assets", [])
        for asset in assets:
            amount = asset.get("amount", 0)
            purchase_price = asset.get("purchasePrice", 0)
            current_price = asset.get("currentPrice") or purchase_price
            
            cost = amount * purchase_price
            value = amount * current_price
            
            total_cost += cost
            total_value += value
            
            pnl = value - cost
            pnl_percent = (pnl / cost * 100) if cost > 0 else 0
            
            details.append({
                "asset": asset.get("name") or asset.get("ticker"),
                "pnl": round(pnl, 2),
                "pnl_percent": round(pnl_percent, 2)
            })
            
    total_pnl = total_value - total_cost
    total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0
    
    return {
        "total_pnl": round(total_pnl, 2),
        "total_pnl_percent": round(total_pnl_percent, 2),
        "asset_details": details
    }

CALCULATION_TOOLS = [
    calculate_portfolio_distribution,
    calculate_total_value,
    calculate_profit_loss
]
