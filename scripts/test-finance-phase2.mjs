/**
 * Phase 2 연동 계좌 API 점검
 * node scripts/test-finance-phase2.mjs
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

assert(readFileSync(resolve(root, "src/app/api/finance/accounts/route.ts"), "utf8").includes("linked_accounts"), "accounts API");
assert(readFileSync(resolve(root, "src/app/finance/accounts/[accountId]/page.tsx"), "utf8").includes("/api/finance/accounts/"), "account detail page");

console.log("=== Phase 2 정적 점검 ===");
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

  const createRes = await fetch(`${base}/api/finance/accounts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bankName: "테스트은행",
      accountNumber: "1234567890",
      displayName: "phase2-test",
      balance: 1000000,
    }),
  });
  const createJson = await createRes.json();
  assert(createRes.ok, `계좌 등록 HTTP ${createRes.status}: ${createJson.error ?? ""}`);
  const accountId = createJson.account?.id;
  assert(accountId, "account id");

  const listRes = await fetch(`${base}/api/finance/accounts`, { headers });
  const listJson = await listRes.json();
  assert(listRes.ok, "계좌 목록");
  assert((listJson.accounts ?? []).some((a) => a.id === accountId), "목록에 계좌 포함");

  const depRes = await fetch(`${base}/api/finance/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      depositorName: "phase2-depositor",
      amount: 30000,
      linkedAccountId: accountId,
      memo: "phase2-test",
    }),
  });
  assert(depRes.ok, "계좌 연결 입금");

  const detailRes = await fetch(`${base}/api/finance/accounts/${accountId}`, { headers });
  const detailJson = await detailRes.json();
  assert(detailRes.ok, "계좌 상세");
  assert((detailJson.transactions ?? []).length >= 1, "계좌 거래내역");

  const financeRes = await fetch(`${base}/api/finance?sync=0`, { headers });
  const financeJson = await financeRes.json();
  assert(Array.isArray(financeJson.accounts), "finance API accounts");
  const tx = (financeJson.transactions ?? []).find((t) => t.memo === "phase2-test");
  assert(tx?.linkedAccountId === accountId, "입금에 계좌 id");

  console.log("HTTP 점검 통과");
} catch (e) {
  console.error("\nHTTP 점검 실패:", e.message || e);
  process.exit(1);
}

console.log("\n모든 점검 완료");
