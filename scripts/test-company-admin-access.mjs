/**
 * 사내관리자(company_admin) 테넌트 관리 권한 검증
 * node scripts/test-company-admin-access.mjs [--base=URL]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ||
  process.env.BASE_URL ||
  "https://lawygo.vercel.app").replace(/\/$/, "");

const errors = [];
function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

function parseCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const lines = raw.length ? raw : [res.headers.get("set-cookie")].filter(Boolean);
  return lines.map((c) => String(c).split(";")[0]).join("; ");
}

const adminSession = readFileSync(resolve(root, "src/lib/adminSession.ts"), "utf8");
check("hasAdminAccess 함수", adminSession.includes("export function hasAdminAccess"));
check("isCompanyAdmin 체크", adminSession.includes("isCompanyAdmin(session)"));
check("menuPermissions * 체크", adminSession.includes('perms.includes("*")'));

console.log(`\nAPI E2E: ${BASE}`);

// 데모(사내관리자, MN 10000)
const demoRes = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
const demoCookie = parseCookie(demoRes);
const demoSession = await demoRes.json().catch(() => ({}));
check("데모 로그인", demoRes.ok, demoSession.error);

const sessionJson = await fetch(`${BASE}/api/auth/session`, {
  headers: { Cookie: demoCookie },
}).then((r) => r.json());
check("isCompanyAdmin 세션", Boolean(sessionJson.user?.isCompanyAdmin));
check("permissionRoleId company_admin", sessionJson.user?.permissionRoleId === "company_admin");

const usersRes = await fetch(`${BASE}/api/admin/users?view=active`, {
  headers: { Cookie: demoCookie },
});
const usersJson = await usersRes.json().catch(() => ({}));
check("사용자 목록 API 200", usersRes.ok, usersJson.error);
check("사용자 1건 이상", (usersJson.count ?? usersJson.users?.length ?? 0) >= 1);

const registryRes = await fetch(`${BASE}/api/admin/company-registry`, {
  headers: { Cookie: demoCookie },
});
const registryJson = await registryRes.json().catch(() => ({}));
check("회사 레지스트리 API 200", registryRes.ok, registryJson.error);
check(
  "자사 관리번호만",
  Array.isArray(registryJson.data) &&
    registryJson.data.every((r) => r.managementNumber === "10000"),
  `rows=${registryJson.data?.length}`
);

const casesRes = await fetch(`${BASE}/api/admin/cases?page=1&page_size=5`, {
  headers: { Cookie: demoCookie },
});
const casesJson = await casesRes.json().catch(() => ({}));
check("사건 목록 API 200", casesRes.ok, casesJson.error);

// 전체관리자
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    loginId: "shinkang",
    password: "0614kang!!",
    managementNumber: "00000",
  }),
});
const platformCookie = parseCookie(loginRes);
check("전체관리자 로그인", loginRes.ok);

const platformUsers = await fetch(`${BASE}/api/admin/users?view=active&scope=all`, {
  headers: { Cookie: platformCookie },
});
const platformJson = await platformUsers.json().catch(() => ({}));
check("전체관리자 사용자 API", platformUsers.ok, platformJson.error);

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
