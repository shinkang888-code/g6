/**
 * 진행상태 필터 API 검증
 * node scripts/test-case-status-filter.mjs [--base=URL]
 */
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] || "https://lawygo.vercel.app").replace(/\/$/, "");

let cookie = "";
const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST", headers: { "Content-Type": "application/json" } });
for (const c of auth.headers.getSetCookie?.() ?? []) {
  const p = c.split(";")[0];
  if (p.startsWith("lawygo_session=")) cookie = p;
}

async function count(statusParam) {
  const q = statusParam ? `status=${encodeURIComponent(statusParam)}` : "";
  const res = await fetch(`${BASE}/api/admin/cases?${q}&page=1&page_size=500`, { headers: { Cookie: cookie } });
  const json = await res.json();
  const rows = json.data ?? [];
  const byStatus = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return { ok: res.ok, total: json.total ?? rows.length, byStatus, error: json.error };
}

const cases = [
  ["진행중", "진행중"],
  ["종결", "종결"],
  ["전체 (진행+종결)", "진행중,종결"],
  ["사임", "사임"],
];

let pass = true;
for (const [label, param] of cases) {
  const r = await count(param);
  const invalid = Object.keys(r.byStatus).filter((s) => {
    if (label === "전체 (진행+종결)") return s !== "진행중" && s !== "종결";
    return s !== label;
  });
  const ok = r.ok && invalid.length === 0;
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗"} ${label}: total=${r.total}`, r.byStatus, invalid.length ? `잘못포함=${invalid.join(",")}` : "");
}

const all = await count("");
const sum = (await Promise.all(cases.slice(0, 3).map(([, p]) => count(p)))).map((r) => r.total);
console.log("\n참고: DB 전체", all.total, "| 진행+종결 합", sum[0] + sum[1], "| 전체필터", sum[2]);

// 검색어 + 진행상태 동시 적용 (종결만)
const qRes = await fetch(
  `${BASE}/api/admin/cases?status=${encodeURIComponent("종결")}&q=${encodeURIComponent("a")}&page=1&page_size=500`,
  { headers: { Cookie: cookie } }
);
const qJson = await qRes.json();
const qRows = qJson.data ?? [];
const qBad = qRows.filter((r) => r.status !== "종결");
const qOk = qRes.ok && qBad.length === 0;
if (!qOk) pass = false;
console.log(`${qOk ? "✓" : "✗"} 검색+종결: ${qRows.length}건`, qBad.length ? `잘못포함=${qBad.map((r) => r.status).join(",")}` : "");

process.exit(pass ? 0 : 1);
