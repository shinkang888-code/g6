/**
 * 모바일 사건 목록 테이블 colgroup·columns 정합성 점검
 * node scripts/test-cases-mobile-table.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const {
  assertMobileTableColumnAlignment,
  MOBILE_COL_WIDTHS,
  MOBILE_HIDDEN_COLUMN_KEYS,
  MOBILE_TABLE_MIN_WIDTH,
} = await import("../src/components/cases/casesMobileTable.ts");

const pageSrc = readFileSync(resolve(root, "src/app/cases/page.tsx"), "utf8");
const colMatch = pageSrc.match(/const columns[^=]*=\s*\[([\s\S]*?)\n\];/);
if (!colMatch) {
  console.error("FAIL: page.tsx 에서 columns 배열을 찾을 수 없습니다.");
  process.exit(1);
}

const keys = [...colMatch[1].matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]);
const errors = assertMobileTableColumnAlignment(keys);

const requiredMobile = [
  "caseNumber",
  "caseName",
  "court",
  "clientName",
  "receivedDate",
  "assignedStaff",
  "nextDate",
  "status",
];

const mustHideOnMobile = ["assistants", "caseType", "clientPosition"];
const visibleMobile = keys.filter((k) => !MOBILE_HIDDEN_COLUMN_KEYS.has(k));
const hiddenCount = [...MOBILE_HIDDEN_COLUMN_KEYS].filter((k) => k !== "sync" && keys.includes(k)).length;

console.log("=== 모바일 사건 테이블 점검 ===\n");
console.log(`columns 키 (${keys.length}):`, keys.join(", "));
console.log(`모바일 표시 열:`, ["checkbox", ...visibleMobile].join(", "));
console.log(`모바일 숨김 열: ${hiddenCount} + sync`);
console.log(`모바일 테이블 min-width: ${MOBILE_TABLE_MIN_WIDTH}px`);

for (const key of requiredMobile) {
  if (!visibleMobile.includes(key)) {
    errors.push(`필수 모바일 열 누락: ${key}`);
  }
}

for (const key of mustHideOnMobile) {
  if (!MOBILE_HIDDEN_COLUMN_KEYS.has(key)) {
    errors.push(`모바일에서 숨겨야 할 열: ${key}`);
  }
}

if (MOBILE_TABLE_MIN_WIDTH >= 600) {
  console.log("OK: 모바일 가로 스크롤 min-width 설정됨");
} else {
  errors.push(`MOBILE_TABLE_MIN_WIDTH 너무 작음: ${MOBILE_TABLE_MIN_WIDTH}`);
}

if (
  pageSrc.includes('mobileColWidth("checkbox")') &&
  pageSrc.includes("columns.map((col) =>") &&
  pageSrc.includes('mobileColWidth("sync")')
) {
  console.log(`OK: 모바일 colgroup이 checkbox + ${keys.length} columns + sync 구조`);
} else {
  errors.push("모바일 colgroup 구조 누락 (mobileColWidth + columns.map)");
}

if (pageSrc.includes("cases-table-mobile") && pageSrc.includes("cases-mobile-case-name")) {
  console.log("OK: 모바일 테이블 CSS 클래스 적용됨");
} else {
  errors.push("cases-table-mobile 또는 cases-mobile-case-name 클래스 누락");
}

if (pageSrc.includes("--cases-mobile-table-min-width")) {
  console.log("OK: 모바일 테이블 min-width CSS 변수 연동됨");
} else {
  errors.push("--cases-mobile-table-min-width CSS 변수 누락");
}

if (pageSrc.includes("mobileColumnLabel") && pageSrc.includes("mobileVisibleCellClass")) {
  console.log("OK: 모바일 열 라벨·셀 폭 클래스 연동됨");
} else {
  errors.push("mobileColumnLabel 또는 mobileVisibleCellClass 누락");
}

if (pageSrc.includes("CaseMobileDetailSheet")) {
  console.log("OK: 모바일 사건 상세 시트 연동됨");
} else {
  errors.push("CaseMobileDetailSheet 누락");
}

if (pageSrc.includes("CasesMobileListShell") && pageSrc.includes("CasesMobileCardList")) {
  console.log("OK: 모바일 목록 셸·카드 리스트 연동");
} else {
  errors.push("CasesMobileListShell 또는 CasesMobileCardList 누락");
}

if (pageSrc.includes('setViewMode("card")') && pageSrc.includes("isMobile")) {
  console.log("OK: 모바일 기본 카드 보기");
} else {
  errors.push("모바일 기본 카드 보기 미설정");
}

if (pageSrc.includes("MOBILE_PAGE_SIZE = 30")) {
  console.log("OK: 모바일 페이지당 30건");
} else {
  errors.push("MOBILE_PAGE_SIZE 설정 누락");
}

if (!pageSrc.includes("max-lg:max-h-[min(560px")) {
  console.log("OK: 모바일 목록 max-height 제한 제거됨");
} else {
  errors.push("모바일 목록 max-height 제한이 남아 있음");
}

if (pageSrc.includes("mobileVisibleCellClass(\"receivedDate\")")) {
  console.log("OK: 모바일 수임일 열 표시");
} else {
  errors.push("모바일 수임일 열 미표시");
}

if (pageSrc.includes('style={col.width ? { minWidth: col.width }')) {
  errors.push("th에 모바일 minWidth 인라인 스타일이 남아 있음");
} else {
  console.log("OK: th 모바일 minWidth 인라인 스타일 제거됨");
}

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
