"""관리자 API 연동 라우트 등록 여부 확인. 프로젝트 루트에서 실행: python scripts/check_admin_api_route.py"""
import sys
sys.path.insert(0, ".")

from main import app

paths = []
for r in app.routes:
    if hasattr(r, "path") and "api_integration" in (r.path or ""):
        paths.append(r.path)
    if hasattr(r, "routes"):
        for sub in r.routes:
            if hasattr(sub, "path") and "api_integration" in (sub.path or ""):
                p = (r.path or "") + (sub.path or "")
                if p not in paths:
                    paths.append(p)

if not paths:
    print("오류: /admin/api_integration 라우트가 등록되어 있지 않습니다.")
    sys.exit(1)

print("등록된 경로:", paths)

from fastapi.testclient import TestClient
client = TestClient(app)
resp = client.get("/admin/api_integration", follow_redirects=False)
print(f"GET /admin/api_integration -> {resp.status_code}")
if resp.status_code == 404:
    print("404가 나오면 서버를 완전히 종료한 뒤 다시 실행하세요: uvicorn main:app --reload --host 127.0.0.1 --port 8000")
    sys.exit(1)
print("정상: 라우트가 인식됩니다. (302=로그인 리다이렉트, 200=페이지 응답)")
