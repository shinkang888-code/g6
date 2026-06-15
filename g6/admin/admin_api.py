"""API 연동 관리자 페이지 - API 키 발급, 기본 URL, 연동 가이드 제공."""
from fastapi import APIRouter, Request

from core.settings import settings
from core.template import AdminTemplates

router = APIRouter()
templates = AdminTemplates()

API_INTEGRATION_MENU_KEY = "100430"


def _is_local_host(host: str) -> bool:
    """로컬 환경 여부 판단."""
    if not host:
        return True
    return host in ("127.0.0.1", "localhost", "::1") or host.startswith("192.168.")


async def _api_integration_view(request: Request):
    """API 연동 페이지 공통 로직."""
    request.session["menu_key"] = API_INTEGRATION_MENU_KEY

    base_url = str(request.base_url).rstrip("/")
    api_base = f"{base_url}/api/v1"
    is_local = _is_local_host(request.url.hostname or "")

    local_base = "http://127.0.0.1:8000"
    local_api_base = f"{local_base}/api/v1"
    deploy_base = base_url if not is_local else base_url
    deploy_api_base = f"{deploy_base}/api/v1" if deploy_base else api_base

    context = {
        "request": request,
        "base_url": base_url,
        "api_base": api_base,
        "is_local": is_local,
        "local_base_url": local_base,
        "local_api_base_url": local_api_base,
        "deploy_base_url": deploy_base,
        "deploy_api_base_url": deploy_api_base,
        "use_api": getattr(settings, "USE_API", True),
    }
    return templates.TemplateResponse("api_integration.html", context)


@router.get("/api_integration", include_in_schema=False)
@router.get("/api_integration/", include_in_schema=False)
async def api_integration(request: Request):
    """
    API 연동 페이지: API 기본 URL, 토큰 발급 안내, 연동 예시 제공.
    """
    return await _api_integration_view(request)
