/**
 * 기일 DB 없음 + 연동 가능 사건만 일괄 기일연동
 * node scripts/sync-no-deadline-cases.mjs [--base=URL] [--limit=N]
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "node:fs";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ||
  process.env.BASE_URL ||
  "https://lawygo.vercel.app"
).replace(/\/$/, "");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const DELAY_MS = Number(process.argv.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? "3000");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

let cookie = "";
async function auth() {
  const res = await fetch(`${BASE}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  return res.ok;
}

if (!(await auth())) {
  console.error("데모 로그인 실패");
  process.exit(1);
}

const listRes = await fetch(`${BASE}/api/cases/sync-deadlines?status=진행중`, {
  headers: { Cookie: cookie },
});
const listJson = await listRes.json();
if (!listRes.ok) {
  console.error("연동 가능 목록 조회 실패:", listJson.error);
  process.exit(1);
}

const hasDl = new Set();
for (let offset = 0; ; offset += 1000) {
  const chunk = await fetch(
    `${url}/rest/v1/deadlines?select=case_id&limit=1000&offset=${offset}`,
    { headers: h }
  ).then((r) => r.json());
  if (!Array.isArray(chunk) || !chunk.length) break;
  for (const d of chunk) hasDl.add(d.case_id);
  if (chunk.length < 1000) break;
}

let targets = (listJson.cases ?? []).filter((c) => !hasDl.has(c.id));
if (LIMIT > 0) targets = targets.slice(0, LIMIT);

console.log(`=== 기일 없음 연동 가능 사건 ===\nBASE: ${BASE}`);
console.log(`대상: ${targets.length}건 (syncable ${listJson.syncable ?? "?"}, 기일없음)\n`);

const results = { ok: 0, fail: 0, skip: 0, noChange: 0, errors: [] };
const t0 = Date.now();

for (let i = 0; i < targets.length; i++) {
  const c = targets[i];
  const label = c.caseNumber ?? c.case_number ?? c.id;
  process.stdout.write(`[${i + 1}/${targets.length}] ${label} … `);
  try {
    const res = await fetch(`${BASE}/api/cases/sync-deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ caseId: c.id }),
    });
    const json = await res.json();
    if (json.ok) {
      if (json.skippedNoChange) {
        results.noChange++;
        console.log("변경없음");
      } else {
        results.ok++;
        console.log(`OK +${json.eventsAdded ?? 0}`);
      }
    } else if (json.skipped) {
      results.skip++;
      console.log(`SKIP ${json.skipReason ?? json.error}`);
    } else {
      results.fail++;
      const err = json.error ?? res.status;
      results.errors.push({ caseNumber: label, error: err });
      console.log(`FAIL ${err}`);
    }
  } catch (e) {
    results.fail++;
    const err = e instanceof Error ? e.message : String(e);
    results.errors.push({ caseNumber: c.case_number, error: err });
    console.log(`ERR ${err}`);
  }
  if (i < targets.length - 1) await sleep(DELAY_MS);
}

const elapsed = Math.round((Date.now() - t0) / 1000);
const summary = {
  ...results,
  targetCount: targets.length,
  elapsedSec: elapsed,
  base: BASE,
  at: new Date().toISOString(),
};
const outPath = resolve(__dir, "../no-deadline-sync-result.json");
writeFileSync(outPath, JSON.stringify(summary, null, 2));

console.log(`\n=== 완료 (${elapsed}s) ===`);
console.log(`성공 ${results.ok}, 변경없음 ${results.noChange}, 제외 ${results.skip}, 실패 ${results.fail}`);
console.log(`결과: ${outPath}`);
