/**
 * 전체관리자 관리번호 전환 + 데모 로그인 E2E
 * BASE_URL=https://lawygo.vercel.app SHINKANG_PASSWORD=xxx node scripts/test-platform-tenant-switch.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = process.env.BASE_URL || "https://lawygo.vercel.app";
const SHINKANG_PASSWORD = process.env.SHINKANG_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || "";

const errors = [];
function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const required = [
  "src/lib/platformTenantSwitch.ts",
  "src/app/api/auth/me/route.ts",
  "src/app/my/page.tsx",
  "src/lib/demoAuth.ts",
];

for (const f of required) {
  check(`파일: ${f}`, existsSync(resolve(root, f)));
}

const switchLib = readFileSync(resolve(root, "src/lib/platformTenantSwitch.ts"), "utf8");
check("activeManagementNumber", switchLib.includes("activeManagementNumber"));
check("validateTenantSwitchTarget", switchLib.includes("validateTenantSwitchTarget"));
check("listSwitchableTenants", switchLib.includes("listSwitchableTenants"));

const meRoute = readFileSync(resolve(root, "src/app/api/auth/me/route.ts"), "utf8");
check("PATCH activeManagementNumber", meRoute.includes("activeManagementNumber"));
check("canSwitchTenant", meRoute.includes("canSwitchTenant"));

const demoAuth = readFileSync(resolve(root, "src/lib/demoAuth.ts"), "utf8");
check("데모 login_id 분리", demoAuth.includes("shinkang888@gmail.com"));
check("데모 ADMIN_ROLE", demoAuth.includes("ADMIN_ROLE_ID"));

const myPage = readFileSync(resolve(root, "src/app/my/page.tsx"), "utf8");
check("마이페이지 전환 UI", myPage.includes("canSwitchTenant"));
check("목록에서 선택", myPage.includes("목록에서 선택"));

function parseCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const lines = raw.length ? raw : [res.headers.get("set-cookie")].filter(Boolean);
  return lines.map((c) => String(c).split(";")[0]).join("; ");
}

async function login(loginId, password, managementNumber) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password, managementNumber }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data, cookie: parseCookie(res) };
}

async function demoLogin() {
  const res = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { res, data, cookie: parseCookie(res) };
}

async function getSession(cookie) {
  const res = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } });
  return res.json().catch(() => ({}));
}

async function patchMe(cookie, body) {
  const res = await fetch(`${BASE}/api/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data, cookie: parseCookie(res) || cookie };
}

if (SHINKANG_PASSWORD) {
  console.log(`\nE2E: ${BASE}`);
  const loginResult = await login("shinkang", SHINKANG_PASSWORD, "00000");
  check("shinkang 로그인", loginResult.res.ok, `shinkang 로그인 실패: ${loginResult.data.error}`);
  if (loginResult.res.ok) {
    let cookie = loginResult.cookie;
    const session1 = await getSession(cookie);
    check(
      "전체관리자 세션",
      Boolean(session1.user?.isPlatformSuperAdmin),
      "isPlatformSuperAdmin=false"
    );
    check(
      "홈 00000",
      session1.user?.homeManagementNumber === "00000" || session1.user?.managementNumber === "00000",
      "home MN 불일치"
    );

    const switchResult = await patchMe(cookie, { activeManagementNumber: "10000" });
    check("10000 전환", switchResult.res.ok, switchResult.data.error);
    if (switchResult.res.ok) {
      cookie = switchResult.cookie;
      const session2 = await getSession(cookie);
      check(
        "active 10000",
        session2.user?.activeManagementNumber === "10000" ||
          session2.user?.managementNumber === "10000",
        `active=${session2.user?.managementNumber}`
      );
      check(
        "전체관리자 유지",
        Boolean(session2.user?.isPlatformSuperAdmin),
        "전환 후 platform 권한 상실"
      );

      const back = await patchMe(cookie, { activeManagementNumber: "00000" });
      check("00000 복귀", back.res.ok, back.data.error);
    }
  }
} else {
  console.log("\nSKIP E2E: SHINKANG_PASSWORD 또는 ADMIN_INITIAL_PASSWORD 미설정");
}

console.log("\n데모 로그인 검증...");
const demo = await demoLogin();
check("데모 로그인", demo.res.ok, demo.data.error);
if (demo.res.ok) {
  const demoSession = await getSession(demo.cookie);
  check(
    "데모 MN 10000",
    demoSession.user?.managementNumber === "10000",
    `MN=${demoSession.user?.managementNumber}`
  );
  check(
    "데모 전체관리자 아님",
    !demoSession.user?.isPlatformSuperAdmin,
    "데모가 전체관리자로 로그인됨"
  );
  check(
    "데모 shinkang 아님",
    demoSession.user?.loginId !== "shinkang",
    `loginId=${demoSession.user?.loginId}`
  );
}

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
