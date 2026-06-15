/**
 * 기일 DB 없음(기일미정) 사건 — 연동 가능 여부·원인 분류
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

const e = loadEnv(resolve(__dir, "../bot/.env"));
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

const { buildScourtJobFromCase } = await import("../src/lib/scourtCaseParams.ts");

const cases = await fetch(
  `${url}/rest/v1/cases?status=eq.진행중&select=id,case_number,court,client_name&limit=2000`,
  { headers: h }
).then((r) => r.json());

const allDl = await fetch(
  `${url}/rest/v1/deadlines?select=case_id&limit=20000`,
  { headers: h }
).then((r) => r.json());

const hasDl = new Set(allDl.map((d) => d.case_id));
const noDlCases = cases.filter((c) => !hasDl.has(c.id));

function bucketReason(raw) {
  if (raw === "연동 가능(미실행)") return raw;
  if (raw.includes("형제") || raw.includes("J키") || raw.startsWith("내부관리번호")) {
    return "내부관리번호(형제/J키 등)";
  }
  if (raw.includes("검찰")) return "검찰 단계 사건";
  if (raw.includes("의뢰인")) return "의뢰인명 문제";
  if (raw.includes("법원") && raw.includes("미등록")) return "법원(계속기관) 미등록";
  if (raw.includes("사건번호 형식")) return "사건번호 형식 불가";
  return raw;
}

const buckets = new Map();
for (const c of noDlCases) {
  const built = buildScourtJobFromCase({
    id: c.id,
    case_number: c.case_number,
    court: c.court,
    client_name: c.client_name,
  });
  const reason = bucketReason(
    "error" in built ? built.error : "연동 가능(미실행)"
  );
  buckets.set(reason, (buckets.get(reason) ?? 0) + 1);
}

console.log("진행중 사건:", cases.length);
console.log("기일 DB 없음:", noDlCases.length);
console.log("\n원인별(집계):");
for (const [reason, count] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${reason}`);
}
