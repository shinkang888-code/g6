/**
 * Phase 1 사건별 수납 API 점검
 * node scripts/test-finance-phase1.mjs
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

assert(
  readFileSync(resolve(root, "src/app/api/finance/cases/[caseId]/route.ts"), "utf8").includes(
    "loadCaseFinanceHistory"
  ),
  "case finance API"
);
assert(
  readFileSync(resolve(root, "src/components/finance/CaseFinanceTab.tsx"), "utf8").includes(
    "/api/finance/cases/"
  ),
  "CaseFinanceTab API 연동"
);
assert(
  readFileSync(resolve(root, "src/lib/financeServer.ts"), "utf8").includes("applyCaseBilling"),
  "applyCaseBilling"
);

console.log("=== Phase 1 정적 점검 ===");
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
  console.log(`서버: ${base}`);

  const auth = await fetch(`${base}/api/auth/demo`, { method: "POST" });
  let cookie = "";
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  if (!cookie) throw new Error("demo login failed");

  const headers = { Cookie: cookie, "Content-Type": "application/json" };

  const casesRes = await fetch(`${base}/api/admin/cases?page_size=1`, { headers });
  const casesJson = await casesRes.json();
  const caseId = casesJson.data?.[0]?.id;
  assert(caseId, "테스트 사건 id");
  if (!caseId) throw new Error("no case");

  const billRes = await fetch(`${base}/api/finance/entries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      caseId,
      amount: 50000,
      description: "phase1-test-billing",
      type: "미수금",
    }),
  });
  const billJson = await billRes.json();
  assert(billRes.ok, `청구 등록 HTTP ${billRes.status}: ${billJson.error ?? ""}`);

  const histRes = await fetch(`${base}/api/finance/cases/${caseId}?sync=0`, { headers });
  const histJson = await histRes.json();
  assert(histRes.ok, `사건 이력 HTTP ${histRes.status}: ${histJson.error ?? ""}`);
  assert(Array.isArray(histJson.receivables), "receivables 배열");
  assert(Array.isArray(histJson.payments), "payments 배열");
  const hasBilling = (histJson.receivables ?? []).some((e) =>
    String(e.description ?? "").includes("phase1-test-billing")
  );
  assert(hasBilling, "청구 이력 반영");
  console.log(`OK: 청구 ${histJson.receivables?.length ?? 0}건 · 수납 ${histJson.payments?.length ?? 0}건`);

  const recvRes = await fetch(`${base}/api/finance/entries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      caseId,
      amount: 50000,
      description: "phase1-test-receipt",
      type: "수납",
    }),
  });
  const recvJson = await recvRes.json();
  assert(recvRes.ok, `수동 수납 HTTP ${recvRes.status}: ${recvJson.error ?? ""}`);

  const afterRes = await fetch(`${base}/api/finance/cases/${caseId}?sync=0`, { headers });
  const afterJson = await afterRes.json();
  const hasPayment = (afterJson.payments ?? []).some((e) =>
    String(e.description ?? "").includes("phase1-test-receipt")
  );
  assert(hasPayment, "수납 이력 반영");
  assert(Number(afterJson.receivedAmount ?? 0) >= 50000, "사건 receivedAmount 반영");
  console.log(`OK: 수납 후 received=${afterJson.receivedAmount}`);

  const dashRes = await fetch(`${base}/api/finance?sync=0`, { headers });
  assert(dashRes.ok, "대시보드 finance API");
  console.log("HTTP 점검 통과");
} catch (e) {
  console.error("\nHTTP 점검 실패:", e.message || e);
  process.exit(1);
}

console.log("\n모든 점검 완료");
