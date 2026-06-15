/**
 * 사건 목록 API 검색 테스트
 * node scripts/test-case-search-api.mjs [q] [--base=URL]
 */
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] || "https://lawygo.vercel.app").replace(/\/$/, "");
const q = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) || "최진건";

let cookie = "";
const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST", headers: { "Content-Type": "application/json" } });
for (const c of auth.headers.getSetCookie?.() ?? []) {
  const p = c.split(";")[0];
  if (p.startsWith("lawygo_session=")) cookie = p;
}

async function query(params) {
  const url = `${BASE}/api/admin/cases?${params}`;
  const res = await fetch(url, { headers: { Cookie: cookie } });
  const json = await res.json();
  console.log("\n---", params, "---");
  console.log("total:", json.total, "rows:", (json.data ?? []).length);
  for (const row of (json.data ?? []).slice(0, 5)) {
    console.log(`  ${row.caseNumber} | ${row.clientName} | ${row.status}`);
  }
}

await query("status=진행중&q=" + encodeURIComponent(q) + "&page=1&page_size=20");
await query("q=" + encodeURIComponent(q) + "&page=1&page_size=20");
await query("page=1&page_size=5");
