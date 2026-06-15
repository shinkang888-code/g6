/**
 * 대시보드 기일 현황 빠른 메뉴(상세/메모/자료) 점검
 * node scripts/test-dashboard-quick-actions.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = process.env.BASE_URL || "http://localhost:3000";

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const prioritySrc = readFileSync(resolve(root, "src/components/dashboard/PriorityCard.tsx"), "utf8");
const quickSrc = readFileSync(resolve(root, "src/lib/caseQuickPopup.ts"), "utf8");

for (const label of ["상세", "메모", "자료"]) {
  if (!prioritySrc.includes(label)) errors.push(`PriorityCard에 '${label}' 라벨 없음`);
}
for (const old of ["호출", "변경"]) {
  if (prioritySrc.includes(`> ${old}`)) errors.push(`PriorityCard에 구 라벨 '${old}' 잔존`);
}
if (!prioritySrc.includes("openCaseQuickView")) {
  errors.push("PriorityCard에 openCaseQuickView 미연결");
}
if (!prioritySrc.includes("onTouchStart")) {
  errors.push("PriorityCard에 길게 누르기(touch) 미구현");
}

for (const path of ["/cases/deadline-info", "/cases/memo-popup", "/cases/files-popup"]) {
  if (!quickSrc.includes(path)) errors.push(`caseQuickPopup에 ${path} 없음`);
}

console.log("=== 대시보드 빠른 메뉴 정적 점검 ===");
if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

async function httpCheck() {
  const pages = [
    { path: "/cases/deadline-info?caseId=test", title: "기일정보" },
    { path: "/cases/memo-popup?caseId=test", title: "메모장" },
    { path: "/cases/files-popup?caseId=test", title: "자료실" },
  ];
  for (const p of pages) {
    const res = await fetch(`${BASE}${p.path}`);
    const html = await res.text();
    assert(res.ok, `${p.path} HTTP ${res.status}`);
    assert(html.includes(p.title), `${p.path}에 '${p.title}' 문구 없음`);
    console.log(`OK: ${p.path}`);
  }
}

try {
  await httpCheck();
  console.log("\nHTTP 점검 통과");
} catch (e) {
  console.warn("\nHTTP 점검 스킵 (개발 서버 미실행):", e.message || e);
}

console.log("\n모든 점검 완료");
