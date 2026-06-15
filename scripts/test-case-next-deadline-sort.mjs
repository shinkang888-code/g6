/**
 * 다음 기일 임박순 정렬 검증
 * node scripts/test-case-next-deadline-sort.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function getDDay(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / 86400000);
}

function rank(date) {
  if (!date) return [2, 1e15];
  const d = getDDay(date);
  if (d >= 0) return [0, d];
  return [1, -d];
}

function isSorted(rows) {
  for (let i = 1; i < rows.length; i++) {
    const [ta, ka] = rank(rows[i - 1].nextDate);
    const [tb, kb] = rank(rows[i].nextDate);
    if (ta > tb) return false;
    if (ta === tb && ka > kb) return false;
  }
  return true;
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
let cookie = "";
try {
  const auth = await fetch(`${BASE}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
} catch {
  /* local without server */
}

const url = `${BASE}/api/admin/cases?status=진행중&sort_by=next_deadline&page=1&page_size=30`;
const res = await fetch(url, { headers: cookie ? { Cookie: cookie } : {} });
const json = await res.json();
const rows = json.data ?? [];

console.log("sortBy:", json.sortBy, "total:", json.total, "page rows:", rows.length);
const withDate = rows.filter((r) => r.nextDate);
console.log(
  "상위 10건:",
  rows.slice(0, 10).map((r) => ({
    case: r.caseNumber,
    client: r.clientName,
    next: r.nextDate ?? "미정",
    dday: r.nextDate ? getDDay(r.nextDate) : null,
  }))
);

const sorted = isSorted(rows);
const firstDday = withDate[0] ? getDDay(withDate[0].nextDate) : null;
console.log(sorted ? "✓ 페이지 내 임박순 정렬 OK" : "✗ 정렬 오류");
if (withDate.length >= 2) {
  const ddays = withDate.map((r) => getDDay(r.nextDate));
  const ok = ddays.every((d, i) => i === 0 || d >= ddays[i - 1] || getDDay(withDate[i - 1].nextDate) < 0);
  console.log(ok ? "✓ 미래 기일 D-Day 오름차순 OK" : "✗ D-Day 순서 오류", "first D-", firstDday);
}
process.exit(sorted ? 0 : 1);
