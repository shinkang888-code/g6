import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";

const cn = process.argv[2] ?? "2025가소10574";
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
const e = { ...loadEnv(resolve(__dir, "../.env.local")), ...loadEnv(resolve(__dir, "../bot/.env")) };
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

const cases = await fetch(`${url}/rest/v1/cases?case_number=eq.${encodeURIComponent(cn)}&select=id,case_number`, { headers: h }).then((r) => r.json());
const c = cases[0];
const dl = await fetch(`${url}/rest/v1/deadlines?case_id=eq.${c.id}&select=id,memo,deadline_date`, { headers: h }).then((r) => r.json());
const settings = await fetch(`${url}/rest/v1/site_settings?key=eq.court_sync_meta&select=value`, { headers: h }).then((r) => r.json());
const meta = settings[0]?.value ? JSON.parse(settings[0].value) : {};
console.log({ case: c, deadlineCount: dl.length, deadlines: dl, syncMeta: meta[c.id] });
