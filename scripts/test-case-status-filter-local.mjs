/**
 * 진행상태 필터 — Supabase 직접 검증
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
const e = { ...loadEnv(resolve(__dir, "../.env.local")), ...loadEnv(resolve(__dir, "../bot/.env")) };
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" };

function parseStatus(status) {
  const s = (status ?? "").trim();
  if (!s) return null;
  if (s === "진행중,종결") return ["진행중", "종결"];
  if (s === "진행중" || s === "종결" || s === "사임") return [s];
  return null;
}

async function countStatus(statusParam) {
  const list = parseStatus(statusParam);
  let q = `${url}/rest/v1/cases?select=status`;
  if (list?.length === 1) q += `&status=eq.${encodeURIComponent(list[0])}`;
  else if (list?.length > 1) q += `&status=in.(${list.map(encodeURIComponent).join(",")})`;
  const res = await fetch(q, { headers: { ...h, Range: "0-999" } });
  const rows = await res.json();
  const byStatus = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const total = res.headers.get("content-range")?.split("/")[1] ?? String(rows.length);
  return { total: Number(total), byStatus };
}

const tests = [
  ["진행중", "진행중"],
  ["종결", "종결"],
  ["전체 (진행+종결)", "진행중,종결"],
  ["사임", "사임"],
];

let pass = true;
for (const [label, param] of tests) {
  const r = await countStatus(param);
  const bad = Object.keys(r.byStatus).filter((s) => {
    if (label === "전체 (진행+종결)") return s !== "진행중" && s !== "종결";
    return s !== label;
  });
  const ok = bad.length === 0;
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${r.total}건`, r.byStatus);
}

process.exit(pass ? 0 : 1);
