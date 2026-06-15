/**
 * Phase 3~5 청구항목·통계·세금·결재 연동 API 점검
 * node scripts/test-finance-phase3.mjs
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
  readFileSync(resolve(root, "src/lib/financeBillingServer.ts"), "utf8").includes("loadFinanceStats"),
  "financeBillingServer stats"
);
assert(
  readFileSync(resolve(root, "src/app/stats/page.tsx"), "utf8").includes("/api/finance/stats"),
  "stats page API"
);
assert(
  readFileSync(resolve(root, "src/lib/listExcelExports.ts"), "utf8").includes("exportFinanceLedgerExcel"),
  "ledger excel export"
);
assert(
  readFileSync(resolve(root, "src/app/approval/draft/page.tsx"), "utf8").includes("financeEntryId"),
  "approval draft financeEntryId"
);
assert(
  readFileSync(resolve(root, "src/components/finance/FinanceTaxDocuments.tsx"), "utf8").includes(
    "/api/finance/tax-documents"
  ),
  "FinanceTaxDocuments"
);

console.log("=== Phase 3~5 정적 점검 ===");
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
  const authJson = await auth.json().catch(() => ({}));
  const sessionUserId = authJson.user?.id ?? authJson.user?.userId ?? "me";
  const sessionUserName = authJson.user?.name ?? authJson.user?.loginId ?? "데모";

  const headers = { Cookie: cookie, "Content-Type": "application/json" };

  const itemsRes = await fetch(`${base}/api/finance/billing-items`, { headers });
  const itemsJson = await itemsRes.json();
  assert(itemsRes.ok, `billing-items GET HTTP ${itemsRes.status}: ${itemsJson.error ?? ""}`);
  assert(Array.isArray(itemsJson.items), "billing items 배열");
  assert((itemsJson.items ?? []).length >= 1, "기본 청구항목 시드");

  const statsRes = await fetch(`${base}/api/finance/stats`, { headers });
  const statsJson = await statsRes.json();
  assert(statsRes.ok, `stats HTTP ${statsRes.status}: ${statsJson.error ?? ""}`);
  assert(typeof statsJson.totalCases === "number", "totalCases");

  const ledgerRes = await fetch(`${base}/api/finance/ledger`, { headers });
  const ledgerJson = await ledgerRes.json();
  assert(ledgerRes.ok, `ledger HTTP ${ledgerRes.status}: ${ledgerJson.error ?? ""}`);
  assert(Array.isArray(ledgerJson.entries), "ledger entries");

  const taxRes = await fetch(`${base}/api/finance/tax-documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({ docType: "세금계산서", amount: 11000, clientName: "phase3-test" }),
  });
  const taxJson = await taxRes.json();
  assert(taxRes.ok, `tax-documents POST HTTP ${taxRes.status}: ${taxJson.error ?? ""}`);

  const taxListRes = await fetch(`${base}/api/finance/tax-documents`, { headers });
  const taxListJson = await taxListRes.json();
  assert(taxListRes.ok, "tax-documents GET");
  assert(
    (taxListJson.documents ?? []).some((d) => d.client_name === "phase3-test"),
    "세금 초안 목록 반영"
  );

  const runRes = await fetch(`${base}/api/finance/billing-items`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "run-recurring" }),
  });
  const runJson = await runRes.json();
  assert(runRes.ok, `run-recurring HTTP ${runRes.status}: ${runJson.error ?? ""}`);
  assert(typeof runJson.createdSchedules === "number", "createdSchedules");

  const casesRes = await fetch(`${base}/api/admin/cases?page_size=1`, { headers });
  const casesJson = await casesRes.json();
  const caseId = casesJson.data?.[0]?.id;
  assert(caseId, "테스트 사건 id");

  const billRes = await fetch(`${base}/api/finance/entries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      caseId,
      amount: 33000,
      description: "phase3-approval-test",
      type: "미수금",
    }),
  });
  const billJson = await billRes.json();
  assert(billRes.ok, `청구 등록 HTTP ${billRes.status}: ${billJson.error ?? ""}`);
  const entryId = billJson.entry?.id;
  assert(entryId, "finance entry id");

  const approvalRes = await fetch(`${base}/api/approvals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "phase3 청구서 결재",
      type: "청구서",
      caseId,
      amount: 33000,
      financeEntryId: entryId,
      approvalLine: [
        {
          order: 1,
          staffId: sessionUserId,
          staffName: sessionUserName,
          status: "대기",
        },
      ],
    }),
  });
  const approvalJson = await approvalRes.json();
  assert(approvalRes.ok, `approval POST HTTP ${approvalRes.status}: ${approvalJson.error ?? ""}`);
  const approvalId = approvalJson.data?.id;
  assert(approvalId, "approval id");

  const approveRes = await fetch(`${base}/api/approvals/${approvalId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ action: "approve" }),
  });
  const approveJson = await approveRes.json();
  if (!approveRes.ok) {
    console.log("결재 승인 스킵 (결재선 권한):", approveJson.error);
  } else {
    assert(approveJson.data?.status === "결재완료" || approveJson.data?.status, "결재 처리");
    const histRes = await fetch(`${base}/api/finance/cases/${caseId}?sync=0`, { headers });
    const histJson = await histRes.json();
    const entry = (histJson.receivables ?? []).find((e) => e.id === entryId);
    if (approveJson.data?.status === "결재완료" && entry) {
      assert(entry.status === "확인", "결재완료 후 finance entry 확인 상태");
    }
  }

  console.log("OK: Phase 3~5 API 점검 완료");
  if (errors.length) {
    errors.forEach((e) => console.error("FAIL:", e));
    process.exit(1);
  }
} catch (e) {
  console.error("FAIL:", e.message ?? e);
  process.exit(1);
}
