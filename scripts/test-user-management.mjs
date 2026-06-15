/**
 * 사용자관리 LawTop 업그레이드 점검
 * node scripts/test-user-management.mjs
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

const files = [
  "src/lib/userAdmin.ts",
  "src/lib/userResign.ts",
  "src/lib/rolePermissionsServer.ts",
  "src/components/admin/UserManagementClient.tsx",
  "src/components/admin/RolesPermissionEditor.tsx",
  "src/app/admin/users/page.tsx",
  "src/app/api/admin/users/route.ts",
  "src/app/api/admin/users/[id]/resign/route.ts",
  "src/app/api/admin/users/resign-bulk/route.ts",
  "supabase/migrations/20260613120000_user_management_lawtop.sql",
];

for (const f of files) {
  check(`파일 존재: ${f}`, existsSync(resolve(root, f)));
}

const userAdmin = readFileSync(resolve(root, "src/lib/userAdmin.ts"), "utf8");
check("isActiveUserStatus", userAdmin.includes("isActiveUserStatus"));
check("isLoginAllowedStatus", userAdmin.includes("isLoginAllowedStatus"));
check("isRelinquishedUserStatus", userAdmin.includes("isRelinquishedUserStatus"));
check("relinquished login message", userAdmin.includes("RELINQUISHED_ACCOUNT_LOGIN_MESSAGE"));

const login = readFileSync(resolve(root, "src/app/api/auth/login/route.ts"), "utf8");
check("login active status", login.includes("isLoginAllowedStatus"));
check("login relinquished code", login.includes("ACCOUNT_RELINQUISHED"));

const googleSignup = readFileSync(resolve(root, "src/app/api/auth/google/complete-signup/route.ts"), "utf8");
check("google signup purge relinquished", googleSignup.includes("purgeRelinquishedAccountForRejoin"));

const userResign = readFileSync(resolve(root, "src/lib/userResign.ts"), "utf8");
check("purgeRelinquishedAccountForRejoin", userResign.includes("purgeRelinquishedAccountForRejoin"));
check("hard delete site_users", userResign.includes('.from("site_users").delete()'));

const staff = readFileSync(resolve(root, "src/app/api/staff/route.ts"), "utf8");
check("staff active filter", staff.includes('"active"'));
check("staff hard delete on exclude", staff.includes("deleteUserAccountForResign"));
check("staff no soft excluded status", !staff.includes('status: "excluded"'));
check("staff no excluded list", !staff.includes("staff_excluded_login_ids"));

const membersPage = readFileSync(resolve(root, "src/app/admin/members/page.tsx"), "utf8");
check("members redirect", membersPage.includes("/admin/users"));

const migration = readFileSync(
  resolve(root, "supabase/migrations/20260613120000_user_management_lawtop.sql"),
  "utf8"
);
check("status check constraint", migration.includes("site_users_status_check"));
check("user_admin_audit_logs", migration.includes("user_admin_audit_logs"));
check("user_memos", migration.includes("user_memos"));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
