/**
 * LawTop 직원목록 엑셀 import 검증
 * node scripts/test-lawtop-staff-import.mjs [excelPath]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const DEFAULT_XLSX =
  process.argv[2] ||
  "c:/Users/user/Dropbox/PC (9)/Downloads/직원목록로탑.xlsx";

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const parserSrc = readFileSync(resolve(root, "src/lib/lawtopStaffExcel.ts"), "utf8");
assert(parserSrc.includes("parseLawtopStaffExcelRows"), "lawtopStaffExcel parser");
assert(parserSrc.includes("mapLawtopUserTypeToRole"), "role mapping");
assert(parserSrc.includes("스탭"), "스탭 매핑");

const importSrc = readFileSync(resolve(root, "src/app/api/admin/members/import-excel/route.ts"), "utf8");
assert(importSrc.includes("isLawtopStaffExcel"), "import API LawTop 감지");
assert(importSrc.includes("requireTenantSession"), "테넌트 세션");
assert(importSrc.includes("managementNumber"), "관리번호 사용");

console.log("=== LawTop 직원 엑셀 정적 점검 ===");
if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

if (!existsSync(DEFAULT_XLSX)) {
  console.log(`HTTP 스킵: 샘플 파일 없음 (${DEFAULT_XLSX})`);
  process.exit(0);
}

async function resolveBaseUrl() {
  for (const url of ["http://localhost:3001", "http://localhost:3000"]) {
    try {
      const r = await fetch(`${url}/api/auth/status`, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status === 401) return url;
    } catch {
      /* next */
    }
  }
  throw new Error("dev server not running");
}

try {
  const base = await resolveBaseUrl();
  console.log(`서버: ${base}`);

  const auth = await fetch(`${base}/api/auth/demo`, { method: "POST" });
  let cookie = "";
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  if (!cookie) throw new Error("demo login failed");

  const buf = readFileSync(DEFAULT_XLSX);
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fd = new FormData();
  fd.append("file", blob, "직원목록로탑.xlsx");
  fd.append("replace", "false");

  const res = await fetch(`${base}/api/admin/members/import-excel`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: fd,
  });
  const json = await res.json();
  assert(res.ok, `import HTTP ${res.status}: ${json.error ?? ""}`);
  assert(json.format === "lawtop", `format=lawtop (got ${json.format})`);
  assert(typeof json.total === "number" && json.total >= 1, `total rows (${json.total})`);
  assert((json.created ?? 0) + (json.updated ?? 0) >= 1, "created 또는 updated >= 1");
  console.log(
    `OK: LawTop ${json.total}행 · 신규 ${json.created ?? 0} · 갱신 ${json.updated ?? 0} · 건너뜀 ${json.skipped ?? 0}`
  );

  const sampleName = "강준철";
  const listRes = await fetch(`${base}/api/staff`, { headers: { Cookie: cookie } });
  const listJson = await listRes.json();
  const found = (listJson.staff ?? []).find((s) => s.name === sampleName);
  assert(found, `직원 목록에 ${sampleName} 반영`);
  if (found) {
    assert(found.email?.includes("@"), `${sampleName} 이메일`);
    assert(found.role === "변호사", `${sampleName} 역할=변호사`);
  }
  console.log(`OK: 직원 목록 ${listJson.staff?.length ?? 0}명 (회사코드 ${listJson.managementNumber})`);
} catch (e) {
  console.error("FAIL:", e.message ?? e);
  if (errors.length) errors.forEach((x) => console.error("FAIL:", x));
  process.exit(1);
}

if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}

console.log("모든 점검 완료");
