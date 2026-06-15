/**
 * 사건 등록 API + 검색 연동 테스트
 * node scripts/test-case-register.mjs
 */
const BASE = (process.env.BASE_URL || "https://lawygo.vercel.app").replace(/\/$/, "");
const stamp = Date.now();
const payload = {
  caseNumber: `DEBUG-${stamp}`,
  caseType: "형사",
  caseName: "등록테스트",
  court: "인천지방법원",
  clientName: "최진건",
  assignedStaff: "최서빈",
  status: "진행중",
  receivedDate: "2026-06-10",
};

const postRes = await fetch(`${BASE}/api/admin/cases`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const postJson = await postRes.json();
console.log("POST", postRes.status, postJson.error || postJson.data?.id);

if (!postRes.ok) process.exit(1);

const id = postJson.data?.id;
const searchRes = await fetch(
  `${BASE}/api/admin/cases?status=진행중&q=${encodeURIComponent("최진건")}&page=1&page_size=20`
);
const searchJson = await searchRes.json();
const hit = (searchJson.data ?? []).find((r) => r.id === id);
console.log("SEARCH status=진행중&q=최진건:", hit ? "FOUND" : "MISSING", "total", searchJson.total);

const searchAllRes = await fetch(
  `${BASE}/api/admin/cases?q=${encodeURIComponent("최진건")}&page=1&page_size=20`
);
const searchAllJson = await searchAllRes.json();
const hitAll = (searchAllJson.data ?? []).find((r) => r.id === id);
console.log("SEARCH q=최진건 (전체상태):", hitAll ? "FOUND" : "MISSING", "total", searchAllJson.total);

if (id) {
  await fetch(`${BASE}/api/admin/cases`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  });
  console.log("cleanup: deleted test case");
}
