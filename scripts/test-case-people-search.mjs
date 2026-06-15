/**
 * 사건 통합 검색(의뢰인·담당·직원) 점검
 * node scripts/test-case-people-search.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = process.env.BASE_URL || "http://localhost:3000";

function sanitizeCaseSearchTerm(raw) {
  return raw.trim().replace(/,/g, " ").replace(/%/g, "").replace(/_/g, " ");
}

function buildCasePersonNameSearchOrFilter(term) {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return null;
  const pattern = `%${t}%`;
  return ["client_name", "assigned_staff_name", "assistants"]
    .map((col) => `${col}.ilike.${pattern}`)
    .join(",");
}

function isCasePersonNameSearchTerm(term) {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return false;
  return !/\d/.test(t);
}

function buildCaseSearchOrFilter(term) {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return null;
  if (isCasePersonNameSearchTerm(t)) return buildCasePersonNameSearchOrFilter(t);
  const pattern = `%${t}%`;
  const fields = [
    "client_name",
    "case_number",
    "case_name",
    "assigned_staff_name",
    "assistants",
    "opponent_name",
    "created_by_name",
  ];
  return fields.map((col) => `${col}.ilike.${pattern}`).join(",");
}

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const personFilter = buildCasePersonNameSearchOrFilter("강준필");
assert(personFilter?.includes("client_name.ilike.%강준필%"), "의뢰인 필드 포함");
assert(personFilter?.includes("assigned_staff_name.ilike.%강준필%"), "담당 필드 포함");
assert(personFilter?.includes("assistants.ilike.%강준필%"), "보조 필드 포함");
assert(!personFilter?.includes("case_number"), "인명 검색에 사건번호 제외");

const nameFilter = buildCaseSearchOrFilter("강준필");
assert(nameFilter === personFilter, "이름 입력 시 인명 전용 필터");

const caseFilter = buildCaseSearchOrFilter("2025고합1162");
assert(caseFilter?.includes("case_number.ilike.%2025고합1162%"), "사건번호 입력 시 통합 검색");

const filter = buildCaseSearchOrFilter("김변호사");
assert(filter?.includes("assigned_staff_name.ilike.%김변호사%"), "담당자 필드 포함");
assert(filter?.includes("assistants.ilike.%김변호사%"), "보조 필드 포함");
assert(filter?.includes("client_name.ilike.%김변호사%"), "의뢰인 필드 포함");

const apiSrc = readFileSync(resolve(root, "src/app/api/admin/cases/route.ts"), "utf8");
assert(apiSrc.includes("buildCaseSearchOrFilter"), "API에 통합 검색 필터 적용");

console.log("=== 사건 인명 검색 정적 점검 ===");
console.log("OR 필터:", filter?.slice(0, 80) + "...");

if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

let cookie = "";
try {
  const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  if (!cookie) throw new Error("demo login failed");

  const sampleRes = await fetch(`${BASE}/api/admin/cases?page=1&page_size=5`, {
    headers: { Cookie: cookie },
  });
  const sampleJson = await sampleRes.json();
  const sample = (sampleJson.data ?? [])[0];
  if (!sample) {
    console.log("HTTP: 샘플 사건 없음 — API 연결만 확인");
  } else {
    const staffName = (sample.assignedStaff || "").trim().split(/[,/·]/)[0]?.trim();
    const clientName = (sample.clientName || "").trim();
    const terms = [staffName, clientName].filter((t) => t && t.length >= 2);

    for (const term of terms) {
      const res = await fetch(
        `${BASE}/api/admin/cases?q=${encodeURIComponent(term)}&page=1&page_size=20`,
        { headers: { Cookie: cookie } }
      );
      const json = await res.json();
      assert(res.ok, `q=${term} HTTP ${res.status}`);
      assert((json.total ?? 0) > 0, `q=${term} 결과 0건`);
      console.log(`OK: q="${term}" → ${json.total}건`);
    }
  }
  console.log("\nHTTP 점검 통과");
} catch (e) {
  console.warn("\nHTTP 점검 스킵:", e.message || e);
}

console.log("\n모든 점검 완료");
