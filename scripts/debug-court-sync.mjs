/**
 * 기일연동 실패 원인 진단
 * node scripts/debug-court-sync.mjs
 * BASE_URL=https://lawygo.vercel.app node scripts/debug-court-sync.mjs --sample 5
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL || "https://lawygo.vercel.app").replace(/\/$/, "");
const SAMPLE = Number(process.argv.find((a) => a.startsWith("--sample="))?.split("=")[1] ?? "3");

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

let cookie = "";

async function auth() {
  const res = await fetch(`${BASE}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const part = c.split(";")[0];
    if (part.startsWith("lawygo_session=")) cookie = part;
  }
  return res.ok;
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer ?? "return=representation",
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json };
}

function parseCaseNumber(caseNumber) {
  const m = (caseNumber ?? "").replace(/\s/g, "").match(/^(\d{4})([가-힣A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return { year: m[1], gubun: m[2], serial: m[3] };
}

function isInternalOnlyCaseNumber(caseNumber) {
  const cn = String(caseNumber ?? "").replace(/\s/g, "");
  if (!cn) return true;
  if (/^J\d/i.test(cn)) return true;
  if (/^\d{4}-\d+/.test(cn)) return true;
  if (/접수/.test(cn)) return true;
  const parsed = parseCaseNumber(cn);
  if (parsed?.gubun === "형제") return true;
  return false;
}

function normalizeParty(raw) {
  let name = String(raw ?? "").trim();
  if (!name) return "";
  name = name.split(/[(（]/)[0]?.trim() ?? name;
  name = name.split(/[,，、]/)[0]?.trim() ?? "";
  name = name.replace(/\s*(외|外)\s*\d*\s*$/u, "").trim();
  name = name.replace(/[$\\#%^&*+_`~=|,'"\-:;％/]/g, "");
  return name.replace(/\s+/g, "");
}

function syncSkipReason(c) {
  const cn = String(c.case_number ?? "").trim();
  if (isInternalOnlyCaseNumber(cn)) {
    if (parseCaseNumber(cn)?.gubun === "형제") return "내부관리번호(형제번호)";
    if (/^J\d/i.test(cn.replace(/\s/g, ""))) return "사건번호 형식 불가 (J내부관리번호)";
    return `내부관리번호 (${cn})`;
  }
  const parsed = parseCaseNumber(cn);
  if (!parsed) return `사건번호 형식 불가 (${cn})`;
  const court = String(c.court ?? "").trim();
  if (!court || court === "미정") return "법원(계속기관) 미등록";
  if (/검찰/.test(court)) return "검찰 단계(법원 검색 불가)";
  const party = String(c.client_name ?? "").trim();
  if (!party || party === "(의뢰인 없음)") return "의뢰인명 없음";
  if (normalizeParty(party).length < 2) return "의뢰인명 정규화 불가";
  return null;
}

async function main() {
  console.log("=== LawyGo 기일연동 진단 ===\n");
  console.log(`BASE: ${BASE}`);
  console.log(`Supabase: ${SUPABASE_URL ? "설정됨" : "미설정"}\n`);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Supabase env 없음. bot/.env 확인");
    process.exit(1);
  }

  // 1) 진행중 사건 수
  const casesRes = await sb(
    "cases?status=eq.진행중&select=id,case_number,court,client_name&order=case_number.asc&limit=2000"
  );
  const cases = casesRes.json ?? [];
  console.log(`진행중 사건(최대 2000): ${cases.length}건`);

  const skipReasons = {};
  const syncable = [];
  for (const c of cases) {
    const reason = syncSkipReason(c);
    if (reason) {
      skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
    } else {
      syncable.push(c);
    }
  }
  console.log(`연동 가능: ${syncable.length}건, 형식 제외: ${cases.length - syncable.length}건`);
  if (Object.keys(skipReasons).length) {
    const grouped = {};
    for (const [k, v] of Object.entries(skipReasons)) {
      let cat = k;
      if (k.startsWith("사건번호 형식 불가")) {
        if (/^J\d/.test(k) || k.includes("J202")) cat = "사건번호 형식 불가 (J내부관리번호)";
        else if (k.includes("접수")) cat = "사건번호 형식 불가 (접수번호)";
        else if (/^\d{4}-\d/.test(k.replace(/.*\((.+)\)/, "$1"))) cat = "사건번호 형식 불가 (YYYY-NNNN)";
        else cat = "사건번호 형식 불가 (기타)";
      }
      grouped[cat] = (grouped[cat] ?? 0) + v;
    }
    console.log("\n[제외 사유 요약]");
    for (const [k, v] of Object.entries(grouped).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${v}건 — ${k}`);
    }
  }

  // 2) 기일 없는 진행중 사건
  const dlRes = await sb("deadlines?select=case_id");
  const withDl = new Set((dlRes.json ?? []).map((r) => r.case_id));
  const noDeadline = syncable.filter((c) => !withDl.has(c.id));
  console.log(`\n기일 DB 없음(연동 가능): ${noDeadline.length}건`);

  // 3) 큐 상태
  const pendingRes = await sb(
    "scourt_search_jobs?status=in.(pending,processing)&select=id,status,created_at,error&order=created_at.desc&limit=10"
  );
  const pending = pendingRes.json ?? [];
  console.log(`\n[큐] pending/processing: ${pending.length}건 (최근 10)`);
  for (const j of pending) {
    console.log(`  ${j.id.slice(0, 8)}… ${j.status} ${j.created_at}`);
  }

  const failedRes = await sb(
    "scourt_search_jobs?status=eq.failed&select=id,error,params,finished_at&order=finished_at.desc&limit=8"
  );
  const failed = failedRes.json ?? [];
  console.log(`\n[큐] 최근 실패 ${failed.length}건`);
  for (const j of failed) {
    const p = j.params ?? {};
    console.log(`  ${p.year ?? ""}${p.gubun ?? ""}${p.serial ?? ""} — ${j.error ?? "(no error)"}`);
  }

  // 4) API 연동 샘플 테스트
  const authed = await auth();
  if (!authed) {
    console.log("\n데모 로그인 실패 — API 샘플 테스트 스킵");
    return;
  }
  console.log("\n[API 샘플 연동 테스트]");
  const targets = noDeadline.slice(0, SAMPLE);
  if (!targets.length) {
    console.log("  테스트 대상 없음 (기일 없는 연동가능 사건 0)");
    targets.push(...syncable.slice(0, SAMPLE));
  }

  for (const c of targets) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/cases/sync-deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ caseId: c.id }),
    });
    const json = await res.json();
    const ms = Date.now() - t0;
    const label = `${c.case_number} | ${c.court} | ${c.client_name}`;
    if (json.ok) {
      console.log(`  OK ${ms}ms — ${label} → 기일 ${json.eventsAdded ?? 0}건`);
    } else if (json.skipped) {
      console.log(`  SKIP — ${label} → ${json.skipReason ?? json.error}`);
    } else {
      console.log(`  FAIL ${res.status} ${ms}ms — ${label}`);
      console.log(`         → ${json.error ?? JSON.stringify(json)}`);
    }
  }

  console.log("\n--- 진단 요약 ---");
  if (pending.length > 0) {
    console.log("• 큐에 pending 작업이 쌓여 있음 → 로컬 `cd bot && npm run queue` 실행 필요");
  }
  if (skipReasons["법원(계속기관) 미등록"]) {
    console.log(`• 법원 미등록 사건 ${skipReasons["법원(계속기관) 미등록"]}건 → 사건 수정에서 계속기관 입력 필요`);
  }
  if (skipReasons["의뢰인명 없음"]) {
    console.log(`• 의뢰인 없음 ${skipReasons["의뢰인명 없음"]}건 → client_name 보완 필요`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
