/**
 * 다음 기일 임박순 — Supabase + 정렬 로직 검증
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

const { sortCasesByNextDeadline } = await import(
  `file://${resolve(__dir, "../src/lib/caseListSort.ts")}`
);
const { pickNextDeadline } = await import(
  `file://${resolve(__dir, "../src/lib/caseDeadlineMemoCore.ts")}`
);

const e = { ...loadEnv(resolve(__dir, "../bot/.env")) };
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

const cases = await fetch(
  `${url}/rest/v1/cases?status=eq.진행중&select=id,case_number,client_name,created_at&limit=800`,
  { headers: h }
).then((r) => r.json());

const ids = cases.map((c) => c.id);
const dlByCase = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const dl = await fetch(
    `${url}/rest/v1/deadlines?case_id=in.(${chunk.join(",")})&select=case_id,deadline_date,deadline_type,memo`,
    { headers: h }
  ).then((r) => r.json());
  for (const d of dl) {
    if (!dlByCase.has(d.case_id)) dlByCase.set(d.case_id, []);
    dlByCase.get(d.case_id).push({
      id: "",
      date: d.deadline_date,
      type: d.deadline_type,
      memo: d.memo,
    });
  }
}

const rows = cases.map((c) => {
  const picked = pickNextDeadline(dlByCase.get(c.id) ?? []);
  return {
    caseNumber: c.case_number,
    clientName: c.client_name,
    createdAt: c.created_at,
    nextDate: picked?.date ?? null,
  };
});

const sorted = sortCasesByNextDeadline(rows);
const withDate = sorted.filter((r) => r.nextDate);

function getDDay(d) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return Math.floor((x - t) / 86400000);
}

let pass = true;
for (let i = 1; i < sorted.length; i++) {
  const a = sorted[i - 1];
  const b = sorted[i];
  const da = a.nextDate ? getDDay(a.nextDate) : 99999;
  const db = b.nextDate ? getDDay(b.nextDate) : 99999;
  const tierA = !a.nextDate ? 2 : da >= 0 ? 0 : 1;
  const tierB = !b.nextDate ? 2 : db >= 0 ? 0 : 1;
  if (tierA > tierB || (tierA === tierB && tierA === 0 && da > db)) {
    pass = false;
    break;
  }
}

console.log("진행중", sorted.length, "건 | 기일 있음", withDate.length, "건");
console.log(
  "상위 8건:",
  sorted.slice(0, 8).map((r) => ({
    case: r.caseNumber,
    next: r.nextDate ?? "미정",
    dday: r.nextDate ? `D-${getDDay(r.nextDate)}` : "-",
  }))
);
console.log(pass ? "✓ 임박순 정렬 OK" : "✗ 정렬 실패");
process.exit(pass ? 0 : 1);
