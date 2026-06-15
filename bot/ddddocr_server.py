"""
ddddocr 캡차 OCR 사이드카 (표준 라이브러리 HTTP 서버, 추가 의존성 없음)

봇(bot/src/ocr.ts 의 DdddocrProvider)이 호출하는 엔드포인트:
  GET  /            → {"ok": true}
  POST /ocr         → body {"image": base64, "charsets"?: str, "png_fix"?: bool}
                      → {"result": "인식문자열"}

실행:
  pip install ddddocr
  python ddddocr_server.py            # 기본 :8000
  python ddddocr_server.py 9000       # 포트 지정
"""
import base64
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import ddddocr

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# 기본 OCR 모델 + beta 모델 둘 다 준비(폴백)
_ocr = ddddocr.DdddOcr(show_ad=False)
try:
    _ocr_beta = ddddocr.DdddOcr(show_ad=False, beta=True)
except Exception:
    _ocr_beta = None


def recognize(img: bytes, charsets: str | None) -> str:
    if charsets:
        try:
            _ocr.set_ranges(charsets)
        except Exception:
            pass
    text = (_ocr.classification(img) or "").strip()
    # 1차 결과가 비면 beta 모델로 재시도
    if not text and _ocr_beta is not None:
        text = (_ocr_beta.classification(img) or "").strip()
    return text


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # 조용히

    def _send(self, status: int, obj: dict):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._send(200, {"ok": True, "engine": "ddddocr"})

    def do_POST(self):
        if not self.path.startswith("/ocr"):
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            data = json.loads(raw.decode("utf-8"))
            b64 = data.get("image", "")
            if not b64:
                self._send(400, {"error": "image(base64) required"})
                return
            img = base64.b64decode(b64)
            result = recognize(img, data.get("charsets"))
            self._send(200, {"result": result})
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})


if __name__ == "__main__":
    print(f"[ddddocr] listening on :{PORT}  (POST /ocr)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
