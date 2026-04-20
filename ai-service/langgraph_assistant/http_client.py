import httpx
import asyncio
from typing import Dict, Any, Optional
import logging
from config import BACKEND_API_TIMEOUT

logger = logging.getLogger(__name__)

class BackendApiError(Exception):
    """Base exception for backend API errors."""
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Backend API Error {status_code}: {detail}")

class BackendApiTimeoutError(BackendApiError):
    """Raised when the backend API request times out."""
    def __init__(self, detail: str = "Backend API timeout"):
        super().__init__(408, detail)

class BackendApiUnavailableError(BackendApiError):
    """Raised when the backend API is unreachable."""
    def __init__(self, detail: str = "Backend API unavailable"):
        super().__init__(503, detail)

class BackendApiClient:
    """Helper class for making async HTTP requests to the .NET backend."""

    def __init__(self, base_url: str, auth_token: str, timeout: float = BACKEND_API_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.auth_token = auth_token
        self.timeout = timeout
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Performs an async GET request with retry logic for 5xx errors."""
        url = f"{self.base_url}/{path.lstrip('/')}"
        
        async with httpx.AsyncClient(headers=self.headers, timeout=self.timeout, verify=False) as client:
            for attempt in range(2):  # 1 initial + 1 retry
                try:
                    response = await client.get(url, params=params)
                    
                    # If 5xx, retry once
                    if 500 <= response.status_code < 600 and attempt == 0:
                        logger.warning(f"Retrying {url} due to 5xx error: {response.status_code}")
                        await asyncio.sleep(1)
                        continue
                    
                    response.raise_for_status()
                    
                    try:
                        return response.json()
                    except (httpx.DecodingError, ValueError):
                        return {}
                        
                except httpx.TimeoutException:
                    raise BackendApiTimeoutError()
                except httpx.ConnectError:
                    raise BackendApiUnavailableError()
                except httpx.HTTPStatusError as e:
                    # After retries or for 4xx errors
                    try:
                        detail = e.response.json().get("detail", str(e))
                    except:
                        detail = str(e)
                    raise BackendApiError(e.response.status_code, detail)
                except Exception as e:
                    logger.error(f"Unexpected error calling backend: {str(e)}")
                    raise BackendApiError(500, str(e))
        
        return {} # Should not reach here
