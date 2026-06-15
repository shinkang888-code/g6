#!/usr/bin/env node
/**
 * G6 submodule(포크) 초기화 + Python 의존성 설치
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const g6Dir = path.join(root, "g6");
const forkUrl = "https://github.com/shinkang888-code/g6.git";

function run(cmd, args, cwd = root) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!fs.existsSync(g6Dir)) {
  console.error("g6/ 폴더가 없습니다. git submodule update --init g6 를 먼저 실행하세요.");
  process.exit(1);
}

run("git", ["remote", "set-url", "origin", forkUrl], g6Dir);
run("git", ["fetch", "origin"], g6Dir);
run("git", ["checkout", "master"], g6Dir);
run("git", ["pull", "origin", "master"], g6Dir);

const venvDir = path.join(g6Dir, ".venv");
const py = process.platform === "win32"
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");

// Python 3.14는 pydantic-core/psycopg2 빌드 실패 → 3.12/3.13 우선
const pythonCandidates = [
  process.env.PYTHON_G6,
  "C:\\Users\\user\\AppData\\Roaming\\uv\\python\\cpython-3.12.13-windows-x86_64-none\\python.exe",
  process.platform === "win32" ? "py" : "python3",
].filter(Boolean);

function findPython() {
  for (const c of pythonCandidates) {
    if (c.includes("\\") || c.includes("/")) {
      if (fs.existsSync(c)) return { cmd: c, args: [] };
    } else if (c === "py") {
      for (const ver of ["-3.13", "-3.12"]) {
        const t = spawnSync("py", [ver, "-c", "import sys; print(sys.version)"], { encoding: "utf8" });
        if (t.status === 0) return { cmd: "py", args: [ver] };
      }
    }
  }
  return { cmd: "python", args: [] };
}

if (fs.existsSync(venvDir)) {
  try { fs.rmSync(venvDir, { recursive: true, force: true }); } catch { /* ignore */ }
}
const pyPick = findPython();
run(pyPick.cmd, [...pyPick.args, "-m", "venv", ".venv"], g6Dir);

run(py, ["-m", "pip", "install", "-U", "pip"], g6Dir);
run(py, ["-m", "pip", "install", "-r", "requirements.txt"], g6Dir);

console.log("\n✓ G6 setup 완료. 다음: npm run dev:g6 → http://127.0.0.1:8000 설치 마법사");
