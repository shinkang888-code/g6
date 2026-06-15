/**
 * Google 가입·관리자 승인 흐름 점검
 * node scripts/test-google-signup-review.mjs
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
  readFileSync(resolve(root, "src/app/api/auth/google/complete-signup/route.ts"), "utf8").includes(
    "가입승인중입니다"
  ),
  "complete-signup pending message"
);
assert(
  readFileSync(resolve(root, "src/app/api/admin/users/[id]/signup-review/route.ts"), "utf8").includes(
    "on_hold"
  ),
  "signup-review API"
);
const signupReviewSrc = readFileSync(
  resolve(root, "src/app/api/admin/users/[id]/signup-review/route.ts"),
  "utf8"
);
assert(signupReviewSrc.includes("requireAdminSession"), "signup-review uses admin session");
assert(signupReviewSrc.includes("assertUserManageableByAdmin"), "signup-review cross-tenant access");
assert(
  !signupReviewSrc.includes("assertUserInTenant"),
  "signup-review must not use session-only tenant check"
);
const bulkSrc = readFileSync(resolve(root, "src/app/api/admin/users/signup-review-bulk/route.ts"), "utf8");
assert(bulkSrc.includes("assertUserManageableByAdmin"), "signup-review-bulk cross-tenant access");
assert(
  readFileSync(resolve(root, "src/lib/companyRegistryAuth.ts"), "utf8").includes("assertUserManageableByAdmin"),
  "companyRegistryAuth helper"
);
assert(
  readFileSync(resolve(root, "src/lib/platformAdmin.ts"), "utf8").includes("canManageCompany"),
  "platform admin company access"
);
assert(
  readFileSync(resolve(root, "src/app/login/signup/google-complete/page.tsx"), "utf8").includes(
    "가입승인중입니다"
  ),
  "google-complete success UI"
);
assert(
  readFileSync(resolve(root, "src/components/admin/UserManagementClient.tsx"), "utf8").includes(
    "signup-review"
  ),
  "admin signup review UI"
);

console.log("=== Google 가입승인 정적 점검 ===");
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

  const queueRes = await fetch(`${base}/api/admin/users?view=signup-queue`, {
    headers: { Cookie: cookie },
  });
  const queueJson = await queueRes.json();
  assert(queueRes.ok, `signup-queue HTTP ${queueRes.status}`);
  assert(Array.isArray(queueJson.users), "signup-queue 배열");
  console.log(`OK: 가입심사 대기열 ${queueJson.users.length}명`);

  const pending = queueJson.users.find((u) => u.status === "pending");
  if (pending) {
    const holdRes = await fetch(`${base}/api/admin/users/${pending.id}/signup-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ action: "hold", comment: "test-hold" }),
    });
    const holdJson = await holdRes.json();
    assert(holdRes.ok, `hold HTTP ${holdRes.status}: ${holdJson.error ?? ""}`);
    assert(holdJson.user?.status === "on_hold", "보류 상태");

    const approveRes = await fetch(`${base}/api/admin/users/${pending.id}/signup-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ action: "approve" }),
    });
    const approveJson = await approveRes.json();
    assert(approveRes.ok, `approve HTTP ${approveRes.status}: ${approveJson.error ?? ""}`);
    assert(approveJson.user?.status === "active", "승인 후 active");
    console.log("OK: 보류 → 승인 API");
  } else {
    console.log("HTTP: 심사 대상 pending 회원 없음 — API 스킵");
  }
} catch (e) {
  console.error("FAIL:", e.message ?? e);
  process.exit(1);
}

console.log("모든 점검 완료");
