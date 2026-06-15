/**
 * LSCC 관리자 보안 콘솔 점검
 * node scripts/test-security-console.mjs [BASE_URL]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const errors = [];

function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const requiredFiles = [
  "src/lib/security/securityModulesCatalog.ts",
  "src/lib/security/securityEventCollector.ts",
  "src/app/api/admin/security/overview/route.ts",
  "src/app/api/admin/security/events/route.ts",
  "src/components/admin/security/SecurityCommandCenter.tsx",
  "src/components/admin/security/SecurityOverviewPanel.tsx",
  "src/components/admin/security/SecurityLogExplorer.tsx",
  "src/app/admin/security/page.tsx",
];

for (const f of requiredFiles) {
  check(`파일 존재: ${f}`, existsSync(resolve(root, f)));
}

check("로그인 보안콘솔 제거", !existsSync(resolve(root, "src/components/auth/LoginSecurityConsole.tsx")));
check("공개 security API 제거", !existsSync(resolve(root, "src/app/api/security/status/route.ts")));

const loginPage = readFileSync(resolve(root, "src/app/login/page.tsx"), "utf8");
check("login 페이지에 LoginSecurityConsole 없음", !loginPage.includes("LoginSecurityConsole"));

const collector = readFileSync(resolve(root, "src/lib/security/securityEventCollector.ts"), "utf8");
check("getSecuritySummary", collector.includes("getSecuritySummary"));
check("listSecurityEvents unresolved", collector.includes("unresolved"));
check("listSecurityEvents search", collector.includes("params.search"));

const overviewApi = readFileSync(resolve(root, "src/app/api/admin/security/overview/route.ts"), "utf8");
check("overview requireAdminSession", overviewApi.includes("requireAdminSession"));

const eventsApi = readFileSync(resolve(root, "src/app/api/admin/security/events/route.ts"), "utf8");
check("events filter source", eventsApi.includes("source:"));
check("events filter ip", eventsApi.includes("ip:"));

const scc = readFileSync(resolve(root, "src/components/admin/security/SecurityCommandCenter.tsx"), "utf8");
check("3탭: overview/logs/audit", scc.includes('"overview"') && scc.includes("SecurityLogExplorer"));

const explorer = readFileSync(resolve(root, "src/components/admin/security/SecurityLogExplorer.tsx"), "utf8");
check("로그 필터 UI", explorer.includes("통합 검색"));
check("페이지네이션", explorer.includes("totalPages"));
check("이벤트 상세", explorer.includes("이벤트 상세"));
check("CSV 내보내기", explorer.includes("exportCsv"));

async function apiChecks() {
  const anonOverview = await fetch(`${BASE}/api/admin/security/overview`);
  check("overview 비로그인 401/403", anonOverview.status === 401 || anonOverview.status === 403);

  const anonEvents = await fetch(`${BASE}/api/admin/security/events`);
  check("events 비로그인 401/403", anonEvents.status === 401 || anonEvents.status === 403);

  const pubStatus = await fetch(`${BASE}/api/security/status`);
  check("공개 /api/security/status 제거(404)", pubStatus.status === 404);

  const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  const setCookie = auth.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) {
    check("데모 로그인", false, "demo login failed — API 테스트 스킵");
    return;
  }

  const overview = await fetch(`${BASE}/api/admin/security/overview`, {
    headers: { Cookie: cookie },
  });
  check("overview 관리자 200", overview.status === 200);
  if (overview.ok) {
    const ov = await overview.json();
    check("overview modules", Array.isArray(ov.modules) && ov.modules.length >= 6);
    check("overview summary", ov.summary && typeof ov.summary.total === "number");
  }

  const events = await fetch(`${BASE}/api/admin/security/events?page_size=5`, {
    headers: { Cookie: cookie },
  });
  check("events 관리자 200", events.status === 200);
  if (events.ok) {
    const ev = await events.json();
    check("events pagination", Array.isArray(ev.data) && typeof ev.total === "number");
  }

  const filtered = await fetch(`${BASE}/api/admin/security/events?source=auth&page_size=3`, {
    headers: { Cookie: cookie },
  });
  check("events source 필터 200", filtered.status === 200);

  const scan = await fetch(`${BASE}/api/admin/security/scan`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  check("admin scan 200", scan.status === 200);
}

await apiChecks();

if (errors.length) {
  console.error("\nFAIL:", errors.length);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("\n모든 보안 콘솔 점검 통과");
