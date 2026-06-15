/**
 * 사건관리 엑셀등록 API E2E 검증
 * node scripts/test-case-excel-import.mjs [--base=URL]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

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

async function login(loginId, password, managementNumber) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password, managementNumber }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data, cookie: parseCookie(res) };
}

function buildTestWorkbook(caseNumber, clientName) {
  const headers = [
    "사건번호",
    "사건종류",
    "사건명",
    "법원",
    "의뢰인",
    "지위",
    "상태",
    "담당자",
    "수임일",
  ];
  const row = [
    caseNumber,
    "민사",
    "엑셀등록테스트",
    "인천지방법원",
    clientName,
    "원고",
    "진행중",
    "신강",
    "2026-06-14",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, row]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사건목록");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = rows[0].map((h) => String(h).trim());
  const dataRow = rows[1];
  const item = {};
  const map = {
    사건번호: "caseNumber",
    사건종류: "caseType",
    사건명: "caseName",
    법원: "court",
    의뢰인: "clientName",
    지위: "clientPosition",
    상태: "status",
    담당자: "assignedStaff",
    수임일: "receivedDate",
  };
  headers.forEach((h, i) => {
    const key = map[h];
    if (key) item[key] = String(dataRow[i] ?? "").trim();
  });
  return [item];
}

// --- static checks ---
const casesPage = readFileSync(resolve(root, "src/app/cases/page.tsx"), "utf8");
check("사건관리 CaseExcelImportButton", casesPage.includes("CaseExcelImportButton"));

const mobileToolbar = readFileSync(resolve(root, "src/components/cases/CasesMobileToolbar.tsx"), "utf8");
check("모바일 엑셀등록", mobileToolbar.includes("엑셀등록"));

const previewRoute = readFileSync(resolve(root, "src/app/api/admin/cases/import-preview/route.ts"), "utf8");
check("import-preview requireTenantSession", previewRoute.includes("requireTenantSession"));
check("import-preview managementNumber", previewRoute.includes("managementNumber"));

console.log(`\nAPI E2E: ${BASE}`);
const stamp = Date.now();
const caseNumber = `EXL-${stamp}`;
const clientName = `엑셀테스트${String(stamp).slice(-4)}`;

const auth = await login("shinkang", "0614kang!!", "00000");
check("shinkang 로그인", auth.res.ok, auth.data.error);
if (!auth.res.ok) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

const items = await parseExcelBuffer(buildTestWorkbook(caseNumber, clientName));
check("엑셀 파싱 1건", items.length === 1 && items[0].caseNumber === caseNumber);

const previewRes = await fetch(`${BASE}/api/admin/cases/import-preview`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: auth.cookie },
  body: JSON.stringify({ items }),
});
const previewJson = await previewRes.json().catch(() => ({}));
check("import-preview 200", previewRes.ok, previewJson.error);
check(
  "import-preview insert ≥1",
  (previewJson.summary?.insert ?? 0) >= 1,
  `insert=${previewJson.summary?.insert}`
);

const toInsert = previewJson.itemsToInsert ?? [];
if (toInsert.length > 0) {
  const importRes = await fetch(`${BASE}/api/admin/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: auth.cookie },
    body: JSON.stringify({ items: toInsert }),
  });
  const importJson = await importRes.json().catch(() => ({}));
  check("엑셀 등록 POST", importRes.ok, importJson.error);
  check("inserted ≥1", (importJson.inserted ?? 0) >= 1, `inserted=${importJson.inserted}`);

  const listRes = await fetch(
    `${BASE}/api/admin/cases?q=${encodeURIComponent(clientName)}&page=1&page_size=20`,
    { headers: { Cookie: auth.cookie } }
  );
  const listJson = await listRes.json().catch(() => ({}));
  const hit = (listJson.data ?? []).find((r) => r.caseNumber === caseNumber);
  check("목록에서 등록 사건 확인", Boolean(hit), `caseNumber=${caseNumber}`);

  if (hit?.id) {
    const delRes = await fetch(`${BASE}/api/admin/cases`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: auth.cookie },
      body: JSON.stringify({ ids: [hit.id] }),
    });
    check("테스트 사건 삭제", delRes.ok);
  }
}

// 데모(체험판) 계정도 preview 가능한지
const demo = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
const demoCookie = parseCookie(demo);
if (demo.ok) {
  const demoPreview = await fetch(`${BASE}/api/admin/cases/import-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoCookie },
    body: JSON.stringify({
      items: [
        {
          caseNumber: `DEMO-${stamp}`,
          caseType: "형사",
          caseName: "데모엑셀",
          court: "서울중앙지방법원",
          clientName: "테스트의뢰인",
          status: "진행중",
        },
      ],
    }),
  });
  const demoJson = await demoPreview.json().catch(() => ({}));
  check("데모 계정 import-preview 허용", demoPreview.ok, demoJson.error);
} else {
  check("데모 로그인", false, "demo login failed");
}

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
