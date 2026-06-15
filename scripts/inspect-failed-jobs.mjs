import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
const FORBIDDEN = /[$\\#%^&*+_`~=|,'"\-:;％/]/;

const res = await fetch(
  `${url}/rest/v1/scourt_search_jobs?status=eq.failed&select=params,error,finished_at&order=finished_at.desc&limit=30`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
const jobs = await res.json();
for (const j of jobs) {
  const p = j.params ?? {};
  const pn = p.partyName ?? "";
  const bad = FORBIDDEN.test(pn.replace(/\s/g, ""));
  console.log(
    `${p.year ?? ""}${p.gubun ?? ""}${p.serial ?? ""}`,
    `party="${pn}"`,
    `len=${pn.length}`,
    `forbidden=${bad}`,
    `err=${j.error}`
  );
}
