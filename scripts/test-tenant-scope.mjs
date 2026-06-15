/**
 * 테넌트 격리(관리번호) 구현 점검
 * node scripts/test-tenant-scope.mjs
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

const requiredFiles = [
  "src/lib/tenantScope.ts",
  "src/app/api/admin/company-groups/route.ts",
  "src/components/admin/CompanyGroupClient.tsx",
  "src/app/admin/company-groups/page.tsx",
  "supabase/migrations/20260611000000_company_tenant_scope.sql",
  "scripts/backfill-tenant-scope.mjs",
  "docs/lawtop-company-account-design.md",
];

for (const f of requiredFiles) {
  check(`파일 존재: ${f}`, existsSync(resolve(root, f)));
}

const tenantScope = readFileSync(resolve(root, "src/lib/tenantScope.ts"), "utf8");
check("requireTenantSession", tenantScope.includes("requireTenantSession"));
check("applyTenantFilter", tenantScope.includes("applyTenantFilter"));
check("assertCaseInTenant", tenantScope.includes("assertCaseInTenant"));
check("assertUserInTenant", tenantScope.includes("assertUserInTenant"));
check("ensureCompanyGroup", tenantScope.includes("ensureCompanyGroup"));

const authSession = readFileSync(resolve(root, "src/lib/authSession.ts"), "utf8");
check("session managementNumber", authSession.includes("managementNumber"));

const login = readFileSync(resolve(root, "src/app/api/auth/login/route.ts"), "utf8");
check("login stores managementNumber", login.includes("managementNumber: user.management_number"));

const casesRoute = readFileSync(resolve(root, "src/app/api/admin/cases/route.ts"), "utf8");
check("cases GET tenant", casesRoute.includes("requireTenantSession") && casesRoute.includes("applyTenantFilter"));

const clientsRoute = readFileSync(resolve(root, "src/app/api/admin/clients/route.ts"), "utf8");
check("clients tenant", clientsRoute.includes("requireTenantSession"));

const deadlinesRoute = readFileSync(resolve(root, "src/app/api/deadlines/route.ts"), "utf8");
check("deadlines tenant", deadlinesRoute.includes("applyTenantFilter"));

const usersRoute = readFileSync(resolve(root, "src/app/api/admin/users/route.ts"), "utf8");
check("users scoped by mgmt", usersRoute.includes('.eq("management_number", managementNumber)'));

const migration = readFileSync(
  resolve(root, "supabase/migrations/20260611000000_company_tenant_scope.sql"),
  "utf8"
);
check("company_groups table", migration.includes("company_groups"));
check("cases management_number", migration.includes("ALTER TABLE cases ADD COLUMN"));

const pkg = readFileSync(resolve(root, "package.json"), "utf8");
check("test:tenant-scope script", pkg.includes("test:tenant-scope"));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
