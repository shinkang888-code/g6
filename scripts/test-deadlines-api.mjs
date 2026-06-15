/**
 * 오늘 구현 기능 스모크: deadlines API clientName·memo
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL || "https://lawygo.vercel.app").replace(/\/$/, "");

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

let cookie = "";
const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
for (const c of auth.headers.getSetCookie?.() ?? []) {
  const p = c.split(";")[0];
  if (p.startsWith("lawygo_session=")) cookie = p;
}

const today = new Date().toISOString().slice(0, 10);
const res = await fetch(`${BASE}/api/deadlines?dateFrom=2026-06-01&dateTo=2026-06-30`, {
  headers: cookie ? { Cookie: cookie } : {},
});
const json = await res.json();
const list = json.data ?? [];
console.log(`deadlines API: ${res.status}, ${list.length}건 (6월)`);

const withClient = list.filter((d) => d.clientName?.trim());
const withMemo = list.filter((d) => d.memo?.includes("[court_sync]"));
const withPlace = list.filter((d) => /제\s*\d+\s*호|호\s*법정/.test(d.memo ?? ""));
console.log(`  clientName 있음: ${withClient.length}건`);
console.log(`  court_sync memo: ${withMemo.length}건`);
console.log(`  호실 memo: ${withPlace.length}건`);

if (withClient[0]) {
  const s = withClient[0];
  console.log("\n샘플:", s.caseNumber, s.clientName, s.type, s.court, (s.memo ?? "").slice(0, 80));
}

// party normalize unit checks
const samples = [
  "서영준, 서윤정",
  "박경환 ,김종철",
  "박서윤(개명전 박주영,김주영)",
  "이승진 外2",
];
function norm(raw) {
  let name = raw.trim();
  name = name.split(/[(（]/)[0]?.trim() ?? name;
  name = name.split(/[,，、]/)[0]?.trim() ?? "";
  name = name.replace(/\s*(외|外)\s*\d*\s*$/u, "").trim();
  name = name.replace(/[$\\#%^&*+_`~=|,'"\-:;％/]/g, "");
  return name.replace(/\s+/g, "");
}
console.log("\n[의뢰인명 정규화]");
for (const s of samples) console.log(`  "${s}" → "${norm(s)}"`);
