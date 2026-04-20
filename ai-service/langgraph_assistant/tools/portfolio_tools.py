from typing import Dict, Any, List, Optional
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
        logger.error(f"Tool backend error: {str(e)}")
        return {"error": e.detail, "_tool_failed": True, "status_code": e.status_code}
    except Exception as e:
        logger.error(f"Unexpected tool error: {str(e)}")
        return {"error": "Unexpected error occurred", "_tool_failed": True}

@tool
async def get_user_portfolios(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Kullanıcının tüm portföylerini listeler.
    Ne zaman kullanılır: Kullanıcı 'portföylerim', 'tüm portföylerim', 'hangi portföylere sahibim', 'portföy listemi getir' gibi sorular sorduğunda.
    Dönen veri: Portföy listesi (id, name, description, assets_summary gibi temel bilgiler).
    """
    return await _call_backend(context, "/api/v1/Portfolios")

@tool
async def get_portfolio_detail(portfolio_id: int, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Belirli bir portföyün detaylarını ve içindeki tüm varlıkları getirir.
    Ne zaman kullanılır: Kullanıcı belirli bir portföyün içeriğini, varlıklarını veya detaylarını sorduğunda.
    Parametre: portfolio_id (int) - Detayı istene portföyün benzersiz kimliği.
    """
    return await _call_backend(context, f"/api/v1/Portfolios/{portfolio_id}")

@tool
async def get_client_portfolios(client_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ekonomist kullanıcılar için belirli bir müşterinin portföylerini listeler.
    Ne zaman kullanılır: Ekonomist rolündeki bir kullanıcı 'müşterimin portföyleri', 'X müşterisinin durumu' gibi sorular sorduğunda.
    Parametre: client_id (str) - Müşterinin benzersiz kimliği.
    Not: Bu tool sadece ECONOMIST rolündeki kullanıcılar içindir.
    """
    user_role = context.get("user_role")
    if user_role != "ECONOMIST":
        return {"error": "Bu işlem için Ekonomist yetkisi gereklidir.", "_tool_failed": True}
        
    return await _call_backend(context, f"/api/v1/Portfolios/client/{client_id}")

PORTFOLIO_TOOLS = [get_user_portfolios, get_portfolio_detail, get_client_portfolios]
