/**
 * 사건번호로 다음 기일 메모 미리보기 (pickNextDeadline + 호실)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";

const caseNumber = process.argv[2];
if (!caseNumber) {
  console.error("Usage: node scripts/verify-case-memo.mjs <사건번호>");
  process.exit(1);
}

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

const e = {
  ...loadEnv(resolve(__dir, "../.env.local")),
  ...loadEnv(resolve(__dir, "../bot/.env")),
};
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

const cases = await fetch(
  `${url}/rest/v1/cases?case_number=eq.${encodeURIComponent(caseNumber)}&select=id,case_number,client_name,court`,
  { headers: h }
).then((r) => r.json());
const c = cases[0];
if (!c) {
  console.error("사건 없음");
  process.exit(1);
}

const dl = await fetch(
  `${url}/rest/v1/deadlines?case_id=eq.${c.id}&select=id,deadline_date,deadline_type,memo,court&order=deadline_date.asc`,
  { headers: h }
).then((r) => r.json());

const { pickNextDeadline, buildAutoDeadlineMemoContent } = await import(
  "../src/lib/caseDeadlineMemoCore.ts"
);

const rows = dl.map((r) => ({
  id: r.id,
  date: r.deadline_date,
  type: r.deadline_type,
  court: r.court,
  memo: r.memo,
}));

const picked = pickNextDeadline(rows);
console.log("picked:", picked);
if (picked) {
  const memo = buildAutoDeadlineMemoContent(picked, {
    caseNumber: c.case_number,
    clientName: c.client_name,
    court: c.court,
  });
  console.log("--- memo ---\n" + memo);
}
