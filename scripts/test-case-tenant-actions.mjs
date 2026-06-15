/**
 * 사건 작업(이력관리·법원기일연동) 테넌트 격리 검증
 * node scripts/test-case-tenant-actions.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = process.env.BASE_URL || "https://lawygo.vercel.app";
const errors = [];

function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const syncRoute = readFileSync(resolve(root, "src/app/api/cases/sync-deadlines/route.ts"), "utf8");
check("sync-deadlines requireTenantSession", syncRoute.includes("requireTenantSession"));
check("sync-deadlines applyTenantFilter", syncRoute.includes("applyTenantFilter"));
check("sync-deadlines managementNumber 전달", syncRoute.includes("syncCaseDeadlines(caseId, session.userId, managementNumber)"));

const courtSync = readFileSync(resolve(root, "src/lib/courtDeadlineSync.ts"), "utf8");
check("syncCaseDeadlines 테넌트 필터", courtSync.includes('.eq("management_number", mn)'));

const historyStorage = readFileSync(resolve(root, "src/lib/caseHistoryStorage.ts"), "utf8");
check("이력 storageKey 테넌트", historyStorage.includes("KEY_PREFIX") && historyStorage.includes("storageKey"));
check("이력 managementNumber 필드", historyStorage.includes("managementNumber: mn"));

const historyPage = readFileSync(resolve(root, "src/app/cases/history/page.tsx"), "utf8");
check("이력 페이지 관리번호 표시", historyPage.includes("관리번호"));

const scourtLink = readFileSync(resolve(root, "src/app/api/cases/scourt-link/route.ts"), "utf8");
check("scourt-link requireTenantSession", scourtLink.includes("requireTenantSession"));

function parseCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const lines = raw.length ? raw : [res.headers.get("set-cookie")].filter(Boolean);
  return lines.map((c) => String(c).split(";")[0]).join("; ");
}

async function demoLogin() {
  const res = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { res, data, cookie: parseCookie(res) };
}

console.log(`\nAPI E2E: ${BASE}`);
const demo = await demoLogin();
check("데모 로그인", demo.res.ok, demo.data.error);

if (demo.res.ok) {
  const listRes = await fetch(`${BASE}/api/cases/sync-deadlines?status=진행중`, {
    headers: { Cookie: demo.cookie },
  });
  const listJson = await listRes.json().catch(() => ({}));
  check("sync-deadlines 목록 200", listRes.ok, listJson.error);
  check(
    "sync-deadlines managementNumber=10000",
    listJson.managementNumber === "10000",
    `MN=${listJson.managementNumber}`
  );

  const adminRes = await fetch(`${BASE}/api/admin/cases?status=진행중&page=1&page_size=500`, {
    headers: { Cookie: demo.cookie },
  });
  const adminJson = await adminRes.json().catch(() => ({}));
  const adminTotal = typeof adminJson.total === "number" ? adminJson.total : adminJson.data?.length ?? 0;
  check(
    "sync 목록 수 ≤ admin 사건 수",
    (listJson.total ?? 0) <= adminTotal + 1,
    `sync=${listJson.total} admin=${adminTotal}`
  );

  if (listJson.cases?.length > 0) {
    const foreignId = "00000000-0000-0000-0000-000000000099";
    const postRes = await fetch(`${BASE}/api/cases/sync-deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: demo.cookie },
      body: JSON.stringify({ caseId: foreignId }),
    });
    const postJson = await postRes.json().catch(() => ({}));
    check(
      "타 테넌트 caseId 거부",
      !postJson.ok && (postJson.error?.includes("관리번호") || postJson.error?.includes("찾을 수 없")),
      postJson.error
    );
  }
}

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
