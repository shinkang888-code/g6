/**
 * 모바일 사건 페이지네이션 로직 점검
 * node scripts/test-cases-mobile-pagination.mjs
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

function buildPageNumberList(currentPage, totalPages) {
  if (totalPages <= 1) return [1];
  const pages = new Set();
  pages.add(1);
  pages.add(totalPages);
  for (let p = currentPage - 2; p <= currentPage + 2; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

check("buildPageNumberList(1,1)", JSON.stringify(buildPageNumberList(1, 1)) === "[1]");
check("buildPageNumberList(5,10)", buildPageNumberList(5, 10).includes(5) && buildPageNumberList(5, 10).includes(1) && buildPageNumberList(5, 10).includes(10));
check("buildPageNumberList(20,40) includes 20", buildPageNumberList(20, 40).includes(20));
check("buildPageNumberList sorted", (() => {
  const p = buildPageNumberList(15, 40);
  for (let i = 1; i < p.length; i++) if (p[i] <= p[i - 1]) return false;
  return true;
})());

const files = [
  "src/components/cases/CasesListPagination.tsx",
  "src/components/cases/CasesMobileTableScroll.tsx",
  "src/components/cases/CasesMobileListShell.tsx",
  "src/components/cases/CasesMobileCardList.tsx",
];
for (const f of files) {
  check(`파일 존재: ${f}`, existsSync(resolve(root, f)));
}

const page = readFileSync(resolve(root, "src/app/cases/page.tsx"), "utf8");
check("pagination in list shell", page.includes("CasesMobileListShell") && page.includes("footer={"));
check("MOBILE_PAGE_SIZE 30", page.includes("MOBILE_PAGE_SIZE = 30"));
check("mobile card default", page.includes('setViewMode("card")'));
check("page change scroll top", page.includes("listScrollRef.current?.scrollTo"));
check("DESKTOP_PAGE_SIZE 20", page.includes("DESKTOP_PAGE_SIZE = 20"));

const shell = readFileSync(resolve(root, "src/components/cases/CasesMobileListShell.tsx"), "utf8");
check("list shell vertical scroll", shell.includes("overflow-y-auto") && shell.includes("flex-1 min-h-0"));

const pagination = readFileSync(resolve(root, "src/components/cases/CasesListPagination.tsx"), "utf8");
check("mobile 44px touch", pagination.includes("min-h-[44px]"));
check("horizontal page tabs", pagination.includes("overflow-x-auto"));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
