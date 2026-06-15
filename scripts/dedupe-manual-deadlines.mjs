/**
 * 동일 사건·날짜·종류에 court_sync 기일이 있으면 엑셀/수동 중복 행 삭제
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

const e = {
  ...loadEnv(resolve(__dir, "../.env.local")),
  ...loadEnv(resolve(__dir, "../bot/.env")),
};
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Supabase env missing");
  process.exit(1);
}
const h = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const rows = await fetch(
  `${url}/rest/v1/deadlines?select=id,case_id,deadline_date,deadline_type,memo&limit=20000`,
  { headers: h }
).then((r) => r.json());

const syncKeys = new Set();
for (const r of rows) {
  if (!String(r.memo ?? "").includes("[court_sync]")) continue;
  syncKeys.add(
    `${r.case_id}|${r.deadline_date}|${String(r.deadline_type ?? "기일").trim()}`
  );
}

const toDelete = [];
for (const r of rows) {
  if (String(r.memo ?? "").includes("[court_sync]")) continue;
  const key = `${r.case_id}|${r.deadline_date}|${String(r.deadline_type ?? "기일").trim()}`;
  if (syncKeys.has(key)) toDelete.push(r.id);
}

console.log("중복 수동 기일 후보:", toDelete.length);
let deleted = 0;
for (const id of toDelete) {
  const res = await fetch(`${url}/rest/v1/deadlines?id=eq.${id}`, {
    method: "DELETE",
    headers: h,
  });
  if (res.ok) deleted += 1;
}
console.log("삭제 완료:", deleted);
