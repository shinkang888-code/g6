#!/usr/bin/env bash
set -euo pipefail

echo "[start] ddddocr sidecar on :8000"
python3 ddddocr_server.py 8000 &
OCR_PID=$!

cleanup() {
  kill "$OCR_PID" 2>/dev/null || true
}
trap cleanup EXIT

# OCR 모델 로딩 대기
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/ >/dev/null 2>&1; then
    echo "[start] ddddocr ready"
    break
  fi
  sleep 1
done

echo "[start] bot worker on PORT=${PORT:-8787}"
exec npm run serve
