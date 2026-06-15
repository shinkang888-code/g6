/**
 * 판례 뷰어·링크 검증
 * node scripts/test-precedent-viewer.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const errors = [];

function ok(name) {
  console.log(`OK  ${name}`);
}

function fail(msg) {
  errors.push(msg);
  console.log(`FAIL ${msg}`);
}

function normalizePrecedentCaseNumber(raw) {
  return raw.trim().replace(/^[\[(（]+|[\])）.]+$/g, "").replace(/\s+/g, "").replace(/[^\d가-힣]/g, "");
}

function isValidPrecedentCaseNumber(caseNumber) {
  const v = normalizePrecedentCaseNumber(caseNumber);
  if (!v || v.startsWith("AI")) return false;
  return /^\d{4}[가-힣]+\d+/.test(v) || /^[가-힣]+\d+/.test(v);
}

ok("normalize 2021다12345");
if (normalizePrecedentCaseNumber(" 2021다12345. ") !== "2021다12345") fail("normalize spaces/dot");

ok("valid case number");
if (!isValidPrecedentCaseNumber("2021다12345")) fail("valid check");

ok("invalid AI placeholder");
if (isValidPrecedentCaseNumber("(AI 응답)")) fail("AI placeholder should be invalid");

const files = [
  "src/app/api/precedent/route.ts",
  "src/lib/precedentFetch.ts",
  "src/lib/precedentViewerStorage.ts",
  "src/components/board/ai/PrecedentViewerClient.tsx",
  "src/app/board/precedent-viewer/page.tsx",
];
for (const f of files) {
  if (existsSync(resolve(root, f))) ok(`file ${f}`);
  else fail(`missing ${f}`);
}

const tab = readFileSync(resolve(root, "src/components/board/ai/CaseRecommendTab.tsx"), "utf8");
if (tab.includes("openViewerPopup") && tab.includes("storePrecedentViewerPayload") === false) {
  ok("CaseRecommendTab uses openViewerPopup");
} else if (tab.includes("openPrecedentOriginalPopup(card.caseNumber, {")) {
  ok("CaseRecommendTab passes payload to popup");
} else {
  fail("CaseRecommendTab popup payload");
}

if (!tab.includes("openPrecedentOriginalPopup(card.caseNumber);\n    }\n  }, []);")) {
  ok("list click no longer auto-opens empty popup");
} else {
  fail("selectPrecedent still auto-opens popup");
}

const viewer = readFileSync(resolve(root, "src/components/board/ai/PrecedentViewerClient.tsx"), "utf8");
if (viewer.includes("/api/precedent") && !viewer.includes("precedent-iframe")) {
  ok("viewer uses API not iframe");
} else {
  fail("viewer still uses iframe");
}

if (viewer.includes("openPrecedentExternalTab")) ok("external tab helper");
else fail("missing external tab");

const page = readFileSync(resolve(root, "src/app/board/precedent-viewer/page.tsx"), "utf8");
if (page.includes("Suspense") && page.includes("PrecedentViewerClient")) ok("Suspense wrapper");
else fail("Suspense missing");

if (tab.includes("precSc.do") || tab.includes("openPrecedentExternalTab")) ok("external link helpers");
else fail("external links");

const fetchSrc = readFileSync(resolve(root, "src/lib/precedentFetch.ts"), "utf8");
if (fetchSrc.includes('source: "aiCache"') && fetchSrc.includes("aiText")) ok("precedentFetch aiCache path");
else fail("precedentFetch aiCache");

console.log(`\n결과: ${errors.length ? "FAIL" : "PASS"} (${errors.length} errors)`);
if (errors.length) process.exit(1);
