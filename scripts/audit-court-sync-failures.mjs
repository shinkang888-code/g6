/**
 * 기일연동 실패 패턴 상세 분석
 * node scripts/audit-court-sync-failures.mjs
 */
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

const botEnv = loadEnv(resolve(__dir, "../bot/.env"));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || botEnv.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || botEnv.SUPABASE_SERVICE_ROLE_KEY;

const PARTY_FORBIDDEN = /[$\\#%^&*+_`~=|,'"\-:;％/]/g;

function normalizePartyNameForScourt(raw) {
  let name = String(raw ?? "").trim();
  if (!name || name === "(의뢰인 없음)") return "";
  name = name.split(/[,，、]/)[0]?.trim() ?? "";
  name = name.replace(/\s*(외|外)\s*\d*\s*$/u, "").trim();
  name = name.replace(PARTY_FORBIDDEN, "");
  name = name.replace(/\s+/g, "");
  return name;
}

function hasForbiddenAfterNormalize(raw) {
  const n = normalizePartyNameForScourt(raw);
  const fallback = normalizePartyNameForScourt(raw) || String(raw ?? "").trim();
  const test = /[$\\#%^&*+_`~=|,'"\-:;％/]/.test(fallback.replace(/\s/g, ""));
  return { normalized: n, fallback, hasForbidden: test, valid: n.length >= 2 && !/[$\\#%^&*+_`~=|,'"\-:;％/]/.test(n) };
}

function parseCaseNumber(caseNumber) {
  const m = (caseNumber ?? "").replace(/\s/g, "").match(/^(\d{4})([가-힣A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return { year: m[1], gubun: m[2], serial: m[3] };
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  return res.json();
}

async function main() {
  const cases = await sb(
    "cases?status=eq.진행중&select=id,case_number,court,client_name&limit=2000"
  );

  const syncable = [];
  const byGubun = {};
  const partyIssues = [];
  const prosecution = [];
  const branchCourt = [];

  for (const c of cases) {
    const parsed = parseCaseNumber(c.case_number);
    if (!parsed) continue;
    const court = String(c.court ?? "").trim();
    if (!court || court === "미정") continue;
    const party = String(c.client_name ?? "").trim();
    if (!party || party === "(의뢰인 없음)") continue;

    syncable.push(c);
    byGubun[parsed.gubun] = (byGubun[parsed.gubun] ?? 0) + 1;

    const p = hasForbiddenAfterNormalize(party);
    if (!p.valid) {
      partyIssues.push({ case_number: c.case_number, client_name: party, ...p });
    }
    if (court.includes("검찰")) prosecution.push(c);
    if (court.includes("지원")) branchCourt.push(c);
  }

  console.log("=== 연동 가능 사건 분석 ===\n");
  console.log(`총 ${syncable.length}건\n`);

  console.log("[사건구분 분포 — 상위 15]");
  for (const [g, n] of Object.entries(byGubun).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${g}: ${n}건`);
  }

  console.log(`\n[검찰청 계속기관] ${prosecution.length}건 (나의사건검색 대상 아님)`);
  for (const c of prosecution.slice(0, 5)) {
    console.log(`  ${c.case_number} | ${c.court} | ${c.client_name}`);
  }

  console.log(`\n[지원 계속기관] ${branchCourt.length}건`);
  console.log(`\n[당사자명 정규화 실패/특수문자] ${partyIssues.length}건`);
  for (const p of partyIssues.slice(0, 15)) {
    console.log(`  ${p.case_number} | raw="${p.client_name}" → norm="${p.normalized}" forbidden=${p.hasForbidden}`);
  }

  const failedJobs = await sb(
    "scourt_search_jobs?status=eq.failed&select=error,params&order=finished_at.desc&limit=50"
  );
  const errCounts = {};
  for (const j of failedJobs) {
    const e = j.error ?? "(none)";
    errCounts[e] = (errCounts[e] ?? 0) + 1;
  }
  console.log("\n[최근 큐 실패 사유]");
  for (const [e, n] of Object.entries(errCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}건 — ${e}`);
  }

  const metaRes = await sb("app_settings?key=eq.court_deadline_sync_meta&select=value");
  const meta = metaRes?.[0]?.value ?? {};
  const metaKeys = Object.keys(meta);
  let errMeta = 0;
  for (const k of metaKeys) {
    if (meta[k]?.lastError) errMeta++;
  }
  console.log(`\n[sync meta] 추적 사건 ${metaKeys.length}건, lastError 있음 ${errMeta}건`);

  const dl = await sb("deadlines?select=case_id,memo&limit=5000");
  let withPlace = 0;
  let courtSync = 0;
  for (const d of dl) {
    if (String(d.memo ?? "").includes("[court_sync]")) {
      courtSync++;
      if (/제\s*\d+\s*호\s*법정|호\s*법정/.test(String(d.memo))) withPlace++;
    }
  }
  console.log(`\n[deadlines] court_sync ${courtSync}건, 호실 포함 ${withPlace}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
