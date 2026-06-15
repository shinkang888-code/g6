#!/usr/bin/env node
/**
 * G6(FastAPI) 개발 서버 실행 — 포트 8000
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const g6Dir = path.resolve(__dirname, "..", "g6");
const venvDir = path.join(g6Dir, ".venv");

const uvicorn = process.platform === "win32"
  ? path.join(venvDir, "Scripts", "uvicorn.exe")
  : path.join(venvDir, "bin", "uvicorn");

if (!fs.existsSync(uvicorn)) {
  console.error("G6 가상환경이 없습니다. 먼저 npm run setup:g6 를 실행하세요.");
  process.exit(1);
}

console.log("G6 → http://127.0.0.1:8000 (Ctrl+C 종료)");
const child = spawn(
  uvicorn,
  ["main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
  { cwd: g6Dir, stdio: "inherit", shell: false }
);

child.on("exit", (code) => process.exit(code ?? 0));
