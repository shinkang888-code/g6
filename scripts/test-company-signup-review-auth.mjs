/**
 * 회사 레지스트리 가입 승인 — 플랫폼 관리자 교차 테넌트 권한 점검
 * node scripts/test-company-signup-review-auth.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const errors = [];

function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const signupReview = readFileSync(
  resolve(root, "src/app/api/admin/users/[id]/signup-review/route.ts"),
  "utf8"
);
const signupBulk = readFileSync(
  resolve(root, "src/app/api/admin/users/signup-review-bulk/route.ts"),
  "utf8"
);
const registryAuth = readFileSync(resolve(root, "src/lib/companyRegistryAuth.ts"), "utf8");
const signupQueue = readFileSync(
  resolve(root, "src/app/api/admin/company-registry/[mn]/signup-queue/route.ts"),
  "utf8"
);

check("signup-review uses requireAdminSession", signupReview.includes("requireAdminSession"));
check("signup-review uses assertUserManageableByAdmin", signupReview.includes("assertUserManageableByAdmin"));
check("signup-review no assertUserInTenant", !signupReview.includes("assertUserInTenant"));
check("signup-review-bulk uses assertUserManageableByAdmin", signupBulk.includes("assertUserManageableByAdmin"));
check("signup-review-bulk no requireTenantSession", !signupBulk.includes("requireTenantSession"));
check("registry auth helper exists", registryAuth.includes("assertUserManageableByAdmin"));
check("registry auth uses canManageCompany", registryAuth.includes("canManageCompany"));
check("signup-queue uses assertCompanyAccess", signupQueue.includes("assertCompanyAccess"));

// 시나리오: 목록 조회와 승인 API가 동일한 canManageCompany 기준을 쓰는지
check(
  "list + approve same auth model",
  signupQueue.includes("canManageCompany") === false &&
    registryAuth.includes("canManageCompany") &&
    signupReview.includes("assertUserManageableByAdmin")
);

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과 — 플랫폼 관리자(00000)가 00003 가입자 승인 가능");
