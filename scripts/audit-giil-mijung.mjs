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
const e = loadEnv(resolve(__dir, "../bot/.env"));
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

const today = new Date().toISOString().slice(0, 10);
const cases = await fetch(
  `${url}/rest/v1/cases?status=eq.진행중&select=id,case_number,court,client_name&limit=2000`,
  { headers: h }
).then((r) => r.json());

const allDl = await fetch(
  `${url}/rest/v1/deadlines?select=case_id,deadline_date,memo,deadline_type&limit=10000`,
  { headers: h }
).then((r) => r.json());

const byCase = new Map();
for (const d of allDl) {
  if (!byCase.has(d.case_id)) byCase.set(d.case_id, []);
  byCase.get(d.case_id).push(d);
}

let noDl = 0;
let noFuture = 0;
let futureNoPlace = 0;
let futureCourtSync = 0;
let excelOnly = 0;

for (const c of cases) {
  const rows = byCase.get(c.id) ?? [];
  if (!rows.length) {
    noDl++;
    continue;
  }
  const future = rows.filter((r) => r.deadline_date >= today);
  if (!future.length) {
    noFuture++;
    continue;
  }
  const hasSync = future.some((r) => String(r.memo ?? "").includes("[court_sync]"));
  if (hasSync) futureCourtSync++;
  else excelOnly++;

  const score = (memo) => {
    const m = String(memo ?? "");
    let s = 0;
    if (m.includes("[court_sync]")) s += 100;
    if (/제\s*\d+\s*호|\d+\s*호\s*법정|제\s*\d+\s*호법정/.test(m)) s += 50;
    if (/^\d{1,2}:\d{2}/.test(m) || m.includes(" / ")) s += 10;
    return s;
  };
  const next = future.sort((a, b) => {
    const d = a.deadline_date.localeCompare(b.deadline_date);
    if (d !== 0) return d;
    return score(b.memo) - score(a.memo);
  })[0];
  const memo = String(next.memo ?? "");
  const hasPlace = /제\s*\d+\s*호|\d+\s*호\s*법정|본관|별관|법정/.test(memo);
  if (!hasPlace) futureNoPlace++;
}

console.log("진행중", cases.length);
console.log("기일 DB 없음:", noDl, "→ 목록 기일미정");
console.log("미래 기일 없음(과거만):", noFuture);
console.log("미래 기일 있음 + court_sync:", futureCourtSync);
console.log("미래 기일 있음 + 엑셀/수동만:", excelOnly, "→ 호실 없을 가능성 높음");
console.log("미래 최근 기일에 호실 memo 없음:", futureNoPlace);
