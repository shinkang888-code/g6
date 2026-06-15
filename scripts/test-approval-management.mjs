/**
 * 결재관리 API·UI 연동 검증
 * node scripts/test-approval-management.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const base = process.argv[2] ?? "http://localhost:3000";
const errors = [];

function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const tab = readFileSync(resolve(root, "src/components/board/ApprovalManagementTab.tsx"), "utf8");
check("mockApprovals 제거", !tab.includes("mockApprovals"));
check("fetchApprovalManagementDocs", tab.includes("fetchApprovalManagementDocs"));

const api = readFileSync(resolve(root, "src/lib/approvalApi.ts"), "utf8");
check("management 옵션", api.includes("management?: boolean"));
check("fetchApprovalManagementDocs 함수", api.includes("export async function fetchApprovalManagementDocs"));

const route = readFileSync(resolve(root, "src/app/api/approvals/route.ts"), "utf8");
check("management=1 파라미터", route.includes('management") === "1"'));
check("테넌트 requester 필터", route.includes('.in("requester_id", tenantMemberIds)'));
check("결재완료만 필터", route.includes('d.status === "결재완료"'));

const mock = readFileSync(resolve(root, "src/lib/mockData.ts"), "utf8");
check("mockApprovals 빈 배열 확인", mock.includes("export const mockApprovals: ApprovalDoc[] = [];"));

async function apiFetch(path, cookie) {
  const res = await fetch(`${base}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

try {
  const login = await fetch(`${base}/api/auth/demo`, { method: "POST" });
  const setCookie = login.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!login.ok) {
    check("데모 로그인", false, `데모 로그인 실패 ${login.status}`);
  } else {
    check("데모 로그인", true);
    const mgmt = await apiFetch("/api/approvals?management=1", cookie);
    check("management API 200", mgmt.res.ok, `status ${mgmt.res.status}`);
    check("management API 배열", Array.isArray(mgmt.json.data));
    if (mgmt.res.ok && Array.isArray(mgmt.json.data)) {
      const allCompleted = mgmt.json.data.every(
        (d) => d.status === "결재완료" && !d.deletedAt
      );
      check("응답 모두 결재완료", allCompleted);
      console.log(`  → 결재완료 문서 ${mgmt.json.data.length}건`);
    }
  }
} catch (e) {
  check("라이브 API 검증", false, e instanceof Error ? e.message : String(e));
}

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
