"""
Vercel 배포 후 기능 점검 스크립트.
사용: BASE_URL=https://g6-o1atag2tg-shinkang888-codes-projects.vercel.app python scripts/vercel_smoke_test.py
로컬: BASE_URL=http://127.0.0.1:8000 python scripts/vercel_smoke_test.py
"""
import os
import sys

try:
    import httpx
except ImportError:
    print("httpx 필요: pip install httpx")
    sys.exit(1)

BASE_URL = os.environ.get("BASE_URL", "https://g6-o1atag2tg-shinkang888-codes-projects.vercel.app").rstrip("/")

CHECKS = [
    ("GET", "/", "메인"),
    ("GET", "/docs", "API 문서 (Swagger)"),
    ("GET", "/admin", "관리자(로그인 리다이렉트 가능)"),
    ("GET", "/admin/api_integration", "관리자 API 연동 페이지"),
]

def main():
    print(f"대상: {BASE_URL}\n")
    failed = []
    for method, path, name in CHECKS:
        url = BASE_URL + path
        try:
            r = httpx.request(method, url, follow_redirects=False, timeout=15)
            ok = r.status_code in (200, 302, 307, 308)
            status = "OK" if ok else "FAIL"
            print(f"  [{status}] {method} {path} -> {r.status_code}  ({name})")
            if not ok:
                failed.append((path, r.status_code))
        except Exception as e:
            print(f"  [ERR] {method} {path}  ({name}): {e}")
            failed.append((path, str(e)))
    print()
    if failed:
        print("실패:", failed)
        sys.exit(1)
    print("기능 점검 통과.")

if __name__ == "__main__":
    main()
