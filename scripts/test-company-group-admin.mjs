/**
 * 회사 그룹·가입 심사 API 점검
 * node scripts/test-company-group-admin.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

assert(readFileSync(resolve(root, "src/lib/managementNumber.ts"), "utf8").includes("normalizeManagementNumber"), "managementNumber lib");
assert(readFileSync(resolve(root, "src/components/admin/CompanyGroupSignupQueue.tsx"), "utf8").includes("signup-review-bulk"), "signup queue UI");
assert(readFileSync(resolve(root, "src/app/api/admin/company-groups/route.ts"), "utf8").includes("signupQueue"), "company-groups signupQueue");

console.log("=== 회사그룹 관리 정적 점검 ===");
if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

async function resolveBaseUrl() {
  for (const url of ["http://localhost:3001", "http://localhost:3000"]) {
    try {
      const r = await fetch(`${url}/api/auth/status`, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status === 401) return url;
    } catch {
      /* next */
    }
  }
  throw new Error("dev server not running");
}

try {
  const base = await resolveBaseUrl();
  const auth = await fetch(`${base}/api/auth/demo`, { method: "POST" });
  let cookie = "";
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  if (!cookie) throw new Error("demo login failed");

  const headers = { Cookie: cookie, "Content-Type": "application/json" };

  const getRes = await fetch(`${base}/api/admin/company-groups?signupQueue=1`, { headers });
  const getJson = await getRes.json();
  assert(getRes.ok, `GET company-groups HTTP ${getRes.status}: ${getJson.error ?? JSON.stringify(getJson)}`);
  assert(getJson.group && getJson.group.managementNumber, `managementNumber missing: ${JSON.stringify(getJson)}`);
  assert(Array.isArray(getJson.signupQueue), "signupQueue");
  console.log(`OK: 관리번호 ${getJson.group.managementNumber} · 가입대기 ${getJson.signupQueue.length}명`);

  const patchRes = await fetch(`${base}/api/admin/company-groups`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ groupName: getJson.group.groupName || "테스트 법인", memo: "test" }),
  });
  const patchJson = await patchRes.json();
  assert(patchRes.ok, `PATCH HTTP ${patchRes.status}: ${patchJson.error ?? ""}`);
  console.log("OK: 그룹 정보 저장");
} catch (e) {
  console.error("FAIL:", e.message ?? e);
  process.exit(1);
}

console.log("모든 점검 완료");
