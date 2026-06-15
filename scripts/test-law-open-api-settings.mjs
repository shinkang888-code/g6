/**
 * 국가법령정보 Open API 관리자 설정 점검
 * node scripts/test-law-open-api-settings.mjs
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

assert(readFileSync(resolve(root, "src/lib/lawOpenApiSettings.ts"), "utf8").includes("LAW_GO_KR_OC"), "settings lib");
assert(readFileSync(resolve(root, "src/components/admin/LawOpenApiSettingsPanel.tsx"), "utf8").includes("Vercel에 반영"), "admin UI");
assert(readFileSync(resolve(root, "src/app/api/admin/settings/law-open-api/vercel/route.ts"), "utf8").includes("syncEnvVarsToVercel"), "vercel sync API");
assert(readFileSync(resolve(root, "src/app/api/admin/settings/law-open-api/local-env/route.ts"), "utf8").includes("mergeEnvLocal"), "local env API");
assert(readFileSync(resolve(root, "src/app/api/law/article/route.ts"), "utf8").includes("getLawGoKrOc"), "article API uses settings");

console.log("=== 국가법령정보 API 설정 정적 점검 ===");
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

  const getRes = await fetch(`${base}/api/admin/settings/law-open-api`, { headers });
  const getJson = await getRes.json();
  assert(getRes.ok, `GET settings HTTP ${getRes.status}`);
  assert(getJson.envKey === "LAW_GO_KR_OC", "envKey");
  console.log(`OK: configured=${getJson.configured} source=${getJson.source}`);

  const vercelRes = await fetch(`${base}/api/admin/settings/law-open-api/vercel`, { headers });
  const vercelJson = await vercelRes.json();
  assert(vercelRes.ok, `GET vercel status HTTP ${vercelRes.status}`);
  console.log(`OK: vercel ready=${vercelJson.ready} hasToken=${vercelJson.hasToken}`);
} catch (e) {
  console.error("FAIL:", e.message ?? e);
  process.exit(1);
}

console.log("모든 점검 완료");
