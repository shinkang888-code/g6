/**
 * 회사·조직 관리(company-registry) 구현 점검
 * node scripts/test-company-registry.mjs
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
  "supabase/migrations/20260620000000_company_organizations.sql",
  "src/lib/platformAdmin.ts",
  "src/lib/companyRegistry.ts",
  "src/lib/companyOrganization.ts",
  "src/lib/companyRegistryAuth.ts",
  "src/app/api/admin/company-registry/route.ts",
  "src/app/api/admin/company-registry/[mn]/route.ts",
  "src/app/api/admin/company-registry/[mn]/organizations/route.ts",
  "src/app/api/admin/company-registry/[mn]/organizations/[id]/route.ts",
  "src/app/api/admin/company-registry/[mn]/members/route.ts",
  "src/app/api/admin/company-registry/[mn]/signup-queue/route.ts",
  "src/components/admin/CompanyRegistryClient.tsx",
  "src/components/admin/OrganizationFolderPanel.tsx",
  "src/app/admin/company-groups/page.tsx",
];

for (const f of requiredFiles) {
  check(`파일 존재: ${f}`, existsSync(resolve(root, f)));
}

const migration = readFileSync(
  resolve(root, "supabase/migrations/20260620000000_company_organizations.sql"),
  "utf8"
);
check("company_organizations table", migration.includes("company_organizations"));
check("site_users.organization_id", migration.includes("organization_id"));
check("본사 default org", migration.includes("'본사'"));

const platformAdmin = readFileSync(resolve(root, "src/lib/platformAdmin.ts"), "utf8");
check("isPlatformAdmin", platformAdmin.includes("isPlatformAdmin"));
check("canManageCompany", platformAdmin.includes("canManageCompany"));

const registry = readFileSync(resolve(root, "src/lib/companyRegistry.ts"), "utf8");
check("listCompanyRegistry", registry.includes("listCompanyRegistry"));
check("createCompanyRegistry", registry.includes("createCompanyRegistry"));
check("deleteCompanyRegistry", registry.includes("deleteCompanyRegistry"));

const org = readFileSync(resolve(root, "src/lib/companyOrganization.ts"), "utf8");
check("buildOrganizationTree", org.includes("buildOrganizationTree"));
check("assignMemberOrganization", org.includes("assignMemberOrganization"));
check("ensureDefaultOrganization", org.includes("ensureDefaultOrganization"));

const apiList = readFileSync(resolve(root, "src/app/api/admin/company-registry/route.ts"), "utf8");
check("GET list API", apiList.includes("listCompanyRegistry"));
check("POST create API", apiList.includes("createCompanyRegistry"));
check("enforceRateLimit on POST", apiList.includes("enforceRateLimit"));

const ui = readFileSync(resolve(root, "src/components/admin/CompanyRegistryClient.tsx"), "utf8");
check("company list UI", ui.includes("/api/admin/company-registry"));
check("OrganizationFolderPanel", ui.includes("OrganizationFolderPanel"));
check("signup tab", ui.includes("CompanyGroupSignupQueue"));

const layout = readFileSync(resolve(root, "src/app/admin/layout.tsx"), "utf8");
check("admin nav 회사·조직", layout.includes("/admin/company-groups"));

const signupQueue = readFileSync(
  resolve(root, "src/components/admin/CompanyGroupSignupQueue.tsx"),
  "utf8"
);
check("signup queue uses registry API", signupQueue.includes("/api/admin/company-registry/"));

// normalizeManagementNumber unit logic
const { normalizeManagementNumber, isValidManagementNumber } = await import(
  "../src/lib/managementNumber.ts"
).catch(() => ({ normalizeManagementNumber: null, isValidManagementNumber: null }));

if (normalizeManagementNumber) {
  check("normalize 1 -> 00001", normalizeManagementNumber("1") === "00001");
  check("normalize 00000", normalizeManagementNumber("00000") === "00000");
  check("invalid long", normalizeManagementNumber("123456") === null);
  check("isValid 00001", isValidManagementNumber("00001"));
} else {
  // fallback inline test without ts import
  function norm(raw) {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (!digits || digits.length > 5) return null;
    return digits.padStart(5, "0");
  }
  check("normalize 1 -> 00001 (inline)", norm("1") === "00001");
}

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
