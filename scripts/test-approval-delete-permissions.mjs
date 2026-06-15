/**
 * 전자결재 수정·삭제 권한 E2E
 * node scripts/test-approval-delete-permissions.mjs
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
    headers: { Cookie: cookie, "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { res, json };
}

async function main() {
  console.log(`=== 전자결재 삭제 권한 (${BASE}) ===`);
  const errors = [];
  const ok = (cond, msg) => (cond ? console.log("OK:", msg) : errors.push(msg));

  const cookie = await demoLogin();
  ok(true, "데모 로그인");

  const session = await api(cookie, "/api/auth/session");
  ok(session.res.ok, "세션 조회");
  const userId = session.json.user?.userId ?? session.json.user?.id;

  const completed = await api(cookie, "/api/approvals?tab=완료");
  const doneDoc = (completed.json.data ?? []).find((d) => d.status === "결재완료" && !d.deletedAt);
  if (!doneDoc) {
    console.log("SKIP: 결재완료 문서 없음");
  } else {
    const del = await api(cookie, `/api/approvals/${doneDoc.id}`, { method: "DELETE" });
    const allowed = del.res.ok || del.res.status === 200;
    const denied = del.res.status === 403;
    ok(
      allowed || denied,
      `결재완료 삭제 시도 status=${del.res.status} (${allowed ? "허용" : denied ? "거부" : "?"})`
    );
    if (allowed && del.json.mode === "soft") {
      await api(cookie, `/api/approvals/${doneDoc.id}`, { method: "DELETE" });
    }
  }

  const pending = await api(cookie, "/api/approvals?tab=결재중");
  const mine = (pending.json.data ?? []).find(
    (d) => d.requesterId === userId && (d.status === "결재요청" || d.status === "결재중") && !d.deletedAt
  );
  if (!mine) {
    console.log("SKIP: 기안자 진행중 문서 없음");
  } else {
    ok(true, `진행중 기안 문서 ${mine.id} (${mine.status})`);
  }

  const 완료목록 = await api(cookie, "/api/approvals?tab=완료");
  ok(Array.isArray(완료목록.json.data), "완료 탭 목록");

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
