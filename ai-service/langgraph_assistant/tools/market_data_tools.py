from typing import Dict, Any, Optional
from langchain_core.tools import tool
from langgraph_assistant.http_client import BackendApiClient, BackendApiError
import logging

logger = logging.getLogger(__name__)

async def _call_backend(context: Dict[str, Any], path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Helper to get client info from state and call backend."""
    backend_url = context.get("backend_api_url")
    auth_token = context.get("auth_token")
    
    if not backend_url or not auth_token:
        return {"error": "Backend API URL or Auth Token missing", "_tool_failed": True}
        
    client = BackendApiClient(backend_url, auth_token)
    try:
        return await client.get(path, params=params)
    except BackendApiError as e:
        logger.error(f"Market Data Tool backend error: {str(e)}")
        return {"error": e.detail, "_tool_failed": True, "status_code": e.status_code}
    except Exception as e:
        logger.error(f"Unexpected tool error: {str(e)}")
        return {"error": "Unexpected error occurred", "_tool_failed": True}

@tool
async def get_stock_prices(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Canlı BIST (Borsa İstanbul) hisse senedi fiyatlarını listeler.
    Ne zaman kullanılır: Kullanıcı genel borsa durumu, tüm hisse fiyatları veya 'borsa ne durumda' gibi sorular sorduğunda.
    """
    return await _call_backend(context, "/api/v1/Stocks")

@tool
async def get_stock_price(ticker: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Belirli bir hisse senedinin (ticker) güncel fiyat ve değişim bilgilerini getirir.
    Ne zaman kullanılır: Kullanıcı spesifik bir hisse senedini sorduğunda (örn: 'THYAO ne kadar?', 'Aselsan fiyatı').
    Parametre: ticker (str) - Hisse kodu (örn: THYAO, GARAN).
    """
    return await _call_backend(context, f"/api/v1/Stocks/{ticker.upper()}")

@tool
async def get_crypto_prices(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Popüler kripto para birimlerinin (BTC, ETH, vb.) güncel fiyatlarını listeler.
    Ne zaman kullanılır: Kullanıcı kripto para piyasasını veya genel kripto fiyatlarını sorduğunda.
    """
    return await _call_backend(context, "/api/v1/Crypto")

@tool
async def get_gold_prices(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Altın ve değerli metal (Gram, Çeyrek, Ons vb.) güncel fiyatlarını listeler.
    Ne zaman kullanılır: Kullanıcı altın fiyatlarını, çeyrek altın veya gram altın durumunu sorduğunda.
    """
    return await _call_backend(context, "/api/v1/Gold")

@tool
async def get_forex_rates(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Döviz kurlarını (USD/TRY, EUR/TRY, vb.) listeler.
    Ne zaman kullanılır: Kullanıcı 'dolar ne kadar', 'euro kaç TL' veya genel döviz kurlarını sorduğunda.
    """
    return await _call_backend(context, "/api/v1/Forex")

MARKET_DATA_TOOLS = [
    get_stock_prices, 
    get_stock_price, 
    get_crypto_prices, 
    get_gold_prices, 
    get_forex_rates
]
