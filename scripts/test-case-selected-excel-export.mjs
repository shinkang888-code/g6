/**
 * 사건관리 선택결과 엑셀다운 검증
 * node scripts/test-case-selected-excel-export.mjs [--base=URL]
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

async function fetchCasesByIds(cookie, ids) {
  const unique = [...new Set(ids)];
  const results = await Promise.all(
    unique.map(async (id) => {
      const res = await fetch(`${BASE}/api/admin/cases?id=${encodeURIComponent(id)}`, {
        headers: { Cookie: cookie },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      const rows = Array.isArray(json.data) ? json.data : [];
      return rows[0] ?? null;
    })
  );
  const byId = new Map(results.filter(Boolean).map((c) => [c.id, c]));
  return unique.map((id) => byId.get(id)).filter(Boolean);
}

function casesToSheetRows(cases) {
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
  const rows = cases.map((c) => [
    c.caseNumber ?? "",
    c.caseType ?? "",
    c.caseName ?? "",
    c.court ?? "",
    c.clientName ?? "",
    c.clientPosition ?? "",
    c.status ?? "",
    c.assignedStaff ?? "",
    c.receivedDate ?? "",
  ]);
  return [headers, ...rows];
}

// --- static ---
const casesPage = readFileSync(resolve(root, "src/app/cases/page.tsx"), "utf8");
check("선택결과 엑셀다운 라벨", casesPage.includes('label="선택결과 엑셀다운"'));
check("selectedRows.size count", casesPage.includes("count={selectedRows.size}"));
check("fetchCasesByIds 사용", casesPage.includes("fetchCasesByIds"));
check("선택 안내 메시지", casesPage.includes("엑셀로보낼 사건을 선택하세요."));

const exportsLib = readFileSync(resolve(root, "src/lib/listExcelExports.ts"), "utf8");
check("fetchCasesByIds 함수", exportsLib.includes("export async function fetchCasesByIds"));

const mobile = readFileSync(resolve(root, "src/components/cases/CasesMobileToolbar.tsx"), "utf8");
check("모바일 선택결과 라벨", mobile.includes('label="선택결과 엑셀다운"'));
check("모바일 selectedCount", mobile.includes("count={selectedCount}"));

console.log(`\nAPI E2E: ${BASE}`);
const auth = await login("shinkang", "0614kang!!", "00000");
check("shinkang 로그인", auth.res.ok, auth.data.error);
if (!auth.res.ok) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

const listRes = await fetch(`${BASE}/api/admin/cases?page=1&page_size=5`, {
  headers: { Cookie: auth.cookie },
});
const listJson = await listRes.json().catch(() => ({}));
const cases = Array.isArray(listJson.data) ? listJson.data : [];
check("사건 목록 조회", listRes.ok && cases.length > 0, listJson.error);

if (cases.length >= 2) {
  const selectedIds = [cases[0].id, cases[1].id];
  const fetched = await fetchCasesByIds(auth.cookie, selectedIds);
  check("선택 2건 fetchCasesByIds", fetched.length === 2, `got ${fetched.length}`);
  check(
    "선택 ID 일치",
    fetched.every((c) => selectedIds.includes(c.id)),
    "id mismatch"
  );

  const ws = XLSX.utils.aoa_to_sheet(casesToSheetRows(fetched));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사건목록");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const readBack = XLSX.read(buffer, { type: "buffer" });
  const sheet = readBack.Sheets[readBack.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  check("엑셀 파일 생성", data.length === 3, `rows=${data.length}`);
  check(
    "엑셀 사건번호 포함",
    String(data[1]?.[0] ?? "") === String(fetched[0].caseNumber ?? ""),
    `expected ${fetched[0].caseNumber}`
  );
} else if (cases.length === 1) {
  const fetched = await fetchCasesByIds(auth.cookie, [cases[0].id]);
  check("선택 1건 fetchCasesByIds", fetched.length === 1);
} else {
  check("테스트용 사건 존재", false, "no cases in tenant");
}

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
