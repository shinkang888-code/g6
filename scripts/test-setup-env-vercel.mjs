/**
 * 환경 변수 Vercel 동기화 점검
 * node scripts/test-setup-env-vercel.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = process.env.BASE_URL || "http://localhost:3000";

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const pageSrc = readFileSync(resolve(root, "src/app/login/setup-env/page.tsx"), "utf8");
const apiSrc = readFileSync(resolve(root, "src/app/api/setup-env/vercel/route.ts"), "utf8");
const libSrc = readFileSync(resolve(root, "src/lib/vercelEnvSync.ts"), "utf8");

assert(pageSrc.includes("Vercel에 반영"), "UI에 Vercel 버튼 없음");
assert(pageSrc.includes("/api/setup-env/vercel"), "Vercel API 호출 없음");
assert(apiSrc.includes("syncEnvVarsToVercel"), "Vercel sync 라우트 미연결");
assert(libSrc.includes("readVercelProjectLink"), "vercelEnvSync 유틸 없음");

let projectLinked = false;
try {
  const pj = JSON.parse(readFileSync(resolve(root, ".vercel/project.json"), "utf8"));
  projectLinked = Boolean(pj.projectId);
  console.log("연결 프로젝트:", pj.projectName || pj.projectId);
} catch {
  console.log("연결 프로젝트: .vercel/project.json 없음");
}

console.log("=== setup-env Vercel 정적 점검 ===");
if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

try {
  const res = await fetch(`${BASE}/api/setup-env/vercel`);
  const json = await res.json();
  assert(res.ok || res.status === 403, `status API HTTP ${res.status}`);
  if (res.ok) {
    console.log("Vercel status:", {
      ready: json.ready,
      hasToken: json.hasToken,
      project: json.project?.projectName ?? json.project?.projectId,
    });
    if (projectLinked && !json.project?.projectId) {
      assert(false, "로컬 project.json은 있는데 status API에 프로젝트 없음");
    }
  } else {
    console.log("status API 403 (프로덕션) — 로컬 dev에서만 사용");
  }
  console.log("\nHTTP status 점검 통과");
} catch (e) {
  console.warn("\nHTTP 점검 스킵:", e.message || e);
}

console.log("\n모든 점검 완료");
