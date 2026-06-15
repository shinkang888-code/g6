/**
 * 조직 관리 권한 계층 점검
 * node scripts/test-admin-role-hierarchy.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const errors = [];

function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const required = [
  "src/lib/adminRoles.ts",
  "src/lib/tenantUser.ts",
  "src/components/admin/AdminRoleAssignPanel.tsx",
  "supabase/migrations/20260621000000_admin_role_hierarchy.sql",
];

for (const f of required) {
  check(`파일: ${f}`, existsSync(resolve(root, f)));
}

const adminRoles = readFileSync(resolve(root, "src/lib/adminRoles.ts"), "utf8");
check("전체관리자", adminRoles.includes("전체관리자"));
check("전체부관리자", adminRoles.includes("전체부관리자"));
check("사내관리자", adminRoles.includes("사내관리자"));
check("공동사내관리자", adminRoles.includes("공동사내관리자"));
check("isPlatformSuperAdmin", adminRoles.includes("isPlatformSuperAdmin"));
check("isPlatformDeputy", adminRoles.includes("isPlatformDeputy"));
check("actorCanModifyTargetAdminRole", adminRoles.includes("actorCanModifyTargetAdminRole"));
check("canManageCompanyWorkspace", adminRoles.includes("canManageCompanyWorkspace"));

const signup = readFileSync(resolve(root, "src/app/api/auth/signup/route.ts"), "utf8");
check("관리번호별 첫 가입자", signup.includes('.eq("management_number", managementNumber)'));
check("company_admin 부여", signup.includes("company_admin"));

const messages = readFileSync(resolve(root, "src/app/api/internal-messages/route.ts"), "utf8");
check("메신저 테넌트 필터", messages.includes('.eq("management_number", managementNumber)'));
check("메신저 교차 테넌트 차단", messages.includes("다른 관리번호"));

const permission = readFileSync(resolve(root, "src/app/api/admin/users/[id]/permission/route.ts"), "utf8");
check("권한 계층 검사", permission.includes("actorCanModifyTargetAdminRole"));
check("마지막 사내관리자 보호", permission.includes("마지막 사내관리자"));

const migration = readFileSync(
  resolve(root, "supabase/migrations/20260621000000_admin_role_hierarchy.sql"),
  "utf8"
);
check("is_company_founder 컬럼", migration.includes("is_company_founder"));
check("internal_messages management_number", migration.includes("internal_messages"));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
