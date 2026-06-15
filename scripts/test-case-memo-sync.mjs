/**
 * 사건 메모 동기화·보기 팝업 검증
 * node scripts/test-case-memo-sync.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const errors = [];

function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const storage = readFileSync(resolve(root, "src/lib/caseScopedStorage.ts"), "utf8");
check("persistCaseMemos", storage.includes("export function persistCaseMemos"));
check("subscribeCaseMemoChanges", storage.includes("export function subscribeCaseMemoChanges"));
check("notify on upsert", storage.includes("notifyCaseMemoChanged(caseId)"));

const popupLib = readFileSync(resolve(root, "src/lib/caseMemoViewPopup.ts"), "utf8");
check("openCaseMemoViewPopup", popupLib.includes("export function openCaseMemoViewPopup"));
check("memo-view-popup path", popupLib.includes("/cases/memo-view-popup"));

const casesPage = readFileSync(resolve(root, "src/app/cases/page.tsx"), "utf8");
check("목록 클릭→팝업", casesPage.includes("openCaseMemoViewPopup"));
check("persistCaseMemos 사용", casesPage.includes("persistCaseMemos"));
check("subscribeCaseMemoChanges", casesPage.includes("subscribeCaseMemoChanges"));

const detailPage = readFileSync(resolve(root, "src/app/cases/[id]/page.tsx"), "utf8");
check("상세 persistCaseMemos", detailPage.includes("persistCaseMemos"));
check("상세 subscribe", detailPage.includes("subscribeCaseMemoChanges"));

const viewPopup = readFileSync(resolve(root, "src/app/cases/memo-view-popup/page.tsx"), "utf8");
check("메모 보기 팝업 페이지", viewPopup.includes("CaseMemoViewPopupPage"));

// simulate persist + broadcast flow
const store = {};
function saveJson(key, value) {
  store[key] = JSON.parse(JSON.stringify(value));
}
function loadJson(key, fallback) {
  return store[key] ?? fallback;
}
const events = [];
function notify(caseId) {
  events.push(caseId);
}

function persistCaseMemos(caseId, memos, seed) {
  const all = { ...seed, ...loadJson("lawygo_case_memos", {}) };
  const next = { ...all, [caseId]: memos };
  saveJson("lawygo_case_memos", next);
  notify(caseId);
  return memos;
}

function readCaseMemosForCase(caseId, seed) {
  const all = { ...seed, ...loadJson("lawygo_case_memos", {}) };
  return all[caseId] ?? [];
}

const seed = { c1: [{ id: "m1", content: "old" }] };
persistCaseMemos("c1", [{ id: "m1", content: "from list" }, { id: "m2", content: "new from detail" }], seed);
check("상세 저장 후 storage 반영", readCaseMemosForCase("c1", seed).length === 2);
check("변경 알림", events.includes("c1"));

const listRead = readCaseMemosForCase("c1", seed);
check("목록 재조회 동기화", listRead.some((m) => m.id === "m2"));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
