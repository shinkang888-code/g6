#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const g6Dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "g6");
const py = path.join(g6Dir, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "install-g6-sqlite.py");

if (!fs.existsSync(py)) {
  console.error("g6/.venv 없음 — npm run setup:g6 먼저 실행");
  process.exit(1);
}

const r = spawnSync(py, [script], { cwd: g6Dir, stdio: "inherit", shell: false });
process.exit(r.status ?? 1);
