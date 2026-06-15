/**
 * Phase 0 회계/수납 API 점검
 * node scripts/test-finance-phase0.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE =
  process.env.BASE_URL ||
  (process.env.PORT ? `http://localhost:${process.env.PORT}` : "http://localhost:3001");

async function resolveBaseUrl() {
  for (const url of [BASE, "http://localhost:3001", "http://localhost:3000"]) {
    try {
      const r = await fetch(`${url}/api/auth/status`, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status === 401) return url;
    } catch {
      /* try next */
    }
  }
  return BASE;
}

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const migration = readFileSync(
  resolve(root, "supabase/migrations/20260614000000_finance_tenant_scope.sql"),
  "utf8"
);
assert(migration.includes("finance_entries"), "finance_entries 마이그레이션");
assert(migration.includes("bank_transactions"), "bank_transactions 마이그레이션");
assert(migration.includes("management_number"), "테넌트 컬럼");

const apiFiles = [
  "src/app/api/finance/route.ts",
  "src/app/api/finance/match/route.ts",
  "src/app/api/finance/entries/route.ts",
  "src/app/api/finance/transactions/route.ts",
  "src/lib/financeServer.ts",
];
for (const f of apiFiles) {
  assert(readFileSync(resolve(root, f), "utf8").length > 50, `${f} 존재`);
}

const page = readFileSync(resolve(root, "src/app/finance/page.tsx"), "utf8");
assert(page.includes("/api/finance"), "finance 페이지 API 연동");
assert(!page.includes("mockBankTransactions"), "목업 제거");

console.log("=== Phase 0 회계 정적 점검 ===");
if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

let cookie = "";
try {
  const base = await resolveBaseUrl();
  console.log(`서버: ${base}`);

  const auth = await fetch(`${base}/api/auth/demo`, { method: "POST" });
  const authJson = await auth.json().catch(() => ({}));
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  if (!cookie) throw new Error(`demo login failed: ${authJson.error ?? auth.status}`);

  const headers = { Cookie: cookie, "Content-Type": "application/json" };

  const listRes = await fetch(`${base}/api/finance`, { headers });
  const listJson = await listRes.json();
  assert(listRes.ok, `GET /api/finance HTTP ${listRes.status}: ${listJson.error ?? ""}`);
  assert(Array.isArray(listJson.transactions), "transactions 배열");
  assert(Array.isArray(listJson.entries), "entries 배열");
  assert(listJson.stats, "stats 객체");
  console.log(
    `OK: 입금 ${listJson.transactions.length}건 · 미수 ${listJson.entries.length}건 · 동기화 ${listJson.syncedReceivables ?? 0}`
  );

  const depRes = await fetch(`${base}/api/finance/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      depositorName: "테스트입금자",
      amount: 100000,
      bankName: "테스트은행",
      memo: "phase0-test",
    }),
  });
  const depJson = await depRes.json();
  assert(depRes.ok, `POST transaction HTTP ${depRes.status}: ${depJson.error ?? ""}`);
  const txId = depJson.transaction?.id;
  assert(txId, "입금 id");

  const entryRes = await fetch(`${base}/api/finance/entries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientName: "테스트의뢰인",
      amount: 100000,
      description: "phase0-test",
      caseNumber: "TEST-PHASE0",
    }),
  });
  const entryJson = await entryRes.json();
  assert(entryRes.ok, `POST entry HTTP ${entryRes.status}: ${entryJson.error ?? ""}`);
  const entryId = entryJson.entry?.id;
  assert(entryId, "청구 id");

  const matchRes = await fetch(`${base}/api/finance/match`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pairs: [{ transactionId: txId, entryId }] }),
  });
  const matchJson = await matchRes.json();
  assert(matchRes.ok, `POST match HTTP ${matchRes.status}: ${matchJson.error ?? ""}`);
  assert((matchJson.confirmed ?? 0) >= 1, "매칭 확정 1건 이상");
  console.log(`OK: 매칭 확정 ${matchJson.confirmed}건`);

  const afterRes = await fetch(`${base}/api/finance?sync=0`, { headers });
  const afterJson = await afterRes.json();
  const stillOpen = (afterJson.entries ?? []).some((e) => e.id === entryId);
  assert(!stillOpen, "확정 후 미수 목록에서 제거");
  console.log("OK: 확정 후 목록 갱신");

  console.log("\nHTTP 점검 통과");
} catch (e) {
  console.error("\nHTTP 점검 실패:", e.message || e);
  process.exit(1);
}

console.log("\n모든 점검 완료");
