/**
 * 결재 수정 + 기일연동 UI 게이트 검증
 * node scripts/test-approval-edit-court-sync.mjs
 */
const BASE = process.env.BASE_URL || "https://lawygo.vercel.app";

async function demoLogin() {
  const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  let cookie = "";
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  if (!cookie) throw new Error(`demo login failed (${auth.status})`);
  return cookie;
}

async function api(cookie, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Cookie: cookie, ...(opts.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function main() {
  console.log(`=== 검증 (${BASE}) ===`);
  const errors = [];
  const ok = (cond, msg) => (cond ? console.log("OK:", msg) : errors.push(msg));

  const cookie = await demoLogin();
  ok(true, "데모 로그인");

  // 1) 결재요청 문서 찾기
  const list = await api(cookie, "/api/approvals?tab=나의작성");
  ok(list.res.ok, "나의작성 목록");
  const pending = (list.json.data ?? []).find((d) => d.status === "결재요청");
  if (!pending) {
    console.log("SKIP: 결재요청 문서 없음 — 기안 후 재실행");
  } else {
    const detail = await api(cookie, `/api/approvals/${pending.id}`);
    ok(detail.res.ok, `결재 상세 ${pending.id}`);

    const put = await api(cookie, `/api/approvals/${pending.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${pending.title} (수정테스트)`,
        notes: pending.notes,
        approvalLine: pending.approvalLine,
        metadata: pending.metadata,
      }),
    });
    ok(put.res.ok && put.json.data?.title?.includes("수정테스트"), "결재 PUT 수정");

    // 원복
    await api(cookie, `/api/approvals/${pending.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: pending.title,
        notes: pending.notes,
        approvalLine: pending.approvalLine,
        metadata: pending.metadata,
      }),
    });
  }

  // 3) 2단계 소프트 삭제 (테스트 문서 생성 → 1차 삭제대기 → 2차 영구삭제)
  const staffRes = await api(cookie, "/api/staff");
  const staff = staffRes.json.staff ?? [];
  const meRes = await api(cookie, "/api/auth/me");
  const me = meRes.json.user ?? meRes.json;
  const myId = me?.id ?? me?.userId;
  const approvers = staff.filter((s) => s.id !== myId).slice(0, 1);
  if (approvers.length < 1) {
    console.log("SKIP: 소프트삭제 테스트 — 결재자 없음");
  } else {
    const create = await api(cookie, "/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `[삭제테스트] ${Date.now()}`,
        type: "기타",
        approvalLine: [
          {
            order: 1,
            staffId: approvers[0].id,
            staffName: approvers[0].name,
            role: approvers[0].role ?? "결재자",
            status: "대기",
          },
        ],
        notes: "소프트삭제 E2E",
      }),
    });
    ok(create.res.ok && create.json.data?.id, "테스트 결재 기안");
    const testId = create.json.data?.id;
    if (testId) {
      const soft = await api(cookie, `/api/approvals/${testId}`, { method: "DELETE" });
      ok(soft.res.ok && soft.json.mode === "soft" && soft.json.data?.deletedAt, "1차 소프트삭제");

      const mine = await api(cookie, "/api/approvals?tab=나의작성");
      const found = (mine.json.data ?? []).find((d) => d.id === testId);
      ok(found?.deletedAt, "나의작성 탭에 삭제대기 문서 표시");

      const perm = await api(cookie, `/api/approvals/${testId}`, { method: "DELETE" });
      ok(perm.res.ok && perm.json.mode === "permanent", "2차 영구삭제");

      const gone = await api(cookie, `/api/approvals/${testId}`);
      ok(gone.res.status === 404, "영구삭제 후 조회 불가");
    }
  }

  // 2) scourt-params (마스킹 우회)
  const cases = await api(cookie, "/api/admin/cases?page=1&page_size=5&q=2025가소");
  const caseItem = (cases.json.data ?? []).find((c) => c.caseNumber?.includes("2025가소32949"));
  if (caseItem) {
    const params = await api(cookie, `/api/cases/scourt-params?caseId=${caseItem.id}`);
    ok(params.res.ok && params.json.syncable && params.json.partyName?.length >= 2, `scourt-params ${params.json.partyName}`);
    const sync = await api(cookie, "/api/cases/sync-deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: caseItem.id }),
    });
    ok(sync.res.ok || sync.json.skippedNoChange, `sync-deadlines ${sync.json.ok ? "ok" : sync.json.error ?? sync.json.skipReason}`);
  } else {
    console.log("SKIP: 2025가소32949 사건 없음");
  }

  if (errors.length) {
    console.error("FAIL:");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log("\n모든 검증 통과");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
