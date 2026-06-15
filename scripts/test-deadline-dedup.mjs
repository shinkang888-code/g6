/**
 * 기일 중복 제거 로직 점검
 * node scripts/test-deadline-dedup.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

function normalizeDeadlineCaseNumber(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeDeadlineType(value) {
  const t = String(value ?? "기일").trim();
  return t || "기일";
}

function deadlineDisplayDedupKey(item) {
  const caseKey =
    normalizeDeadlineCaseNumber(item.caseNumber) ||
    String(item.caseId ?? "").trim() ||
    item.id;
  return `${item.date}|${caseKey}|${normalizeDeadlineType(item.type)}`;
}

function deadlineKeepScore(item) {
  let score = 0;
  if (item.memo?.includes("[court_sync]")) score += 200;
  if (item.caseId) score += 50;
  if (item.createdAt) {
    const ts = Date.parse(item.createdAt);
    if (!Number.isNaN(ts)) score += ts / 1_000_000_000;
  }
  return score;
}

function dedupeDeadlinesForDisplay(items) {
  const bestByKey = new Map();
  for (const item of items) {
    const key = deadlineDisplayDedupKey(item);
    const prev = bestByKey.get(key);
    if (!prev || deadlineKeepScore(item) >= deadlineKeepScore(prev)) {
      bestByKey.set(key, item);
    }
  }
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = deadlineDisplayDedupKey(item);
    const winner = bestByKey.get(key);
    if (!winner || winner.id !== item.id) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const dupes = [
  {
    id: "api-1",
    date: "2026-06-10",
    caseNumber: "2025노1959",
    caseId: "case-a",
    type: "변론기일",
    memo: "수동 등록",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "api-2",
    date: "2026-06-10",
    caseNumber: "2025 노1959",
    caseId: "case-a",
    type: "변론기일",
    memo: "[court_sync]2026-06-10|변론기일 14:00",
    createdAt: "2026-02-01T00:00:00Z",
  },
  {
    id: "local-1",
    date: "2026-06-10",
    caseNumber: "2025노1959",
    type: "변론기일",
    memo: "localStorage",
  },
  {
    id: "api-3",
    date: "2026-06-10",
    caseNumber: "2025노1959",
    type: "선고기일",
    memo: "다른 종류",
  },
];

const deduped = dedupeDeadlinesForDisplay(dupes);
assert(deduped.length === 2, `동일 종류 중복 제거 실패: ${deduped.length}건 (기대 2)`);
assert(deduped.some((d) => d.id === "api-2"), "법원연동 행이 우선 선택되어야 함");
assert(deduped.some((d) => d.id === "api-3"), "다른 기일종류는 유지되어야 함");

assert(
  deadlineDisplayDedupKey({ id: "1", date: "2026-06-10", caseNumber: "2025노1959", type: "변론" }) ===
    deadlineDisplayDedupKey({ id: "2", date: "2026-06-10", caseNumber: "2025 노1959", type: "변론" }),
  "사건번호 공백 정규화 키 불일치"
);

const calendarSrc = readFileSync(resolve(root, "src/app/calendar/page.tsx"), "utf8");
const manageSrc = readFileSync(resolve(root, "src/app/calendar/manage/page.tsx"), "utf8");
const apiSrc = readFileSync(resolve(root, "src/app/api/deadlines/route.ts"), "utf8");

if (calendarSrc.includes("dedupeDeadlinesForDisplay")) {
  console.log("OK: calendar/page.tsx dedup 적용");
} else {
  errors.push("calendar/page.tsx에 dedupe 미적용");
}

if (manageSrc.includes("dedupeDeadlinesForDisplay")) {
  console.log("OK: calendar/manage/page.tsx dedup 적용");
} else {
  errors.push("calendar/manage/page.tsx에 dedupe 미적용");
}

if (apiSrc.includes("dedupeDeadlinesForDisplay")) {
  console.log("OK: api/deadlines dedup 적용");
} else {
  errors.push("api/deadlines에 dedupe 미적용");
}

console.log("\n=== 기일 dedup 점검 ===");
console.log(`입력 ${dupes.length}건 → 출력 ${deduped.length}건`);
console.log("선택 id:", deduped.map((d) => d.id).join(", "));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
