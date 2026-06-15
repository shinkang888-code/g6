import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";

const caseNumber = process.argv[2] ?? "2025고합328";
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

const cases = await fetch(
  `${url}/rest/v1/cases?case_number=eq.${encodeURIComponent(caseNumber)}&select=id,case_number,court,client_name`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
).then((r) => r.json());

const c = cases[0];
if (!c) {
  console.log("not found");
  process.exit(0);
}

const dl = await fetch(
  `${url}/rest/v1/deadlines?case_id=eq.${c.id}&select=deadline_date,deadline_type,court,memo&order=deadline_date.asc`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
).then((r) => r.json());

console.log("case:", c);
console.log("deadlines:");
for (const d of dl) console.log(JSON.stringify(d));
