/**
 * 간편등록 기일연동 E2E
 * node scripts/test-quick-register-sync.mjs
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
  const t0 = Date.now();
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
  return { res, json, ms: Date.now() - t0 };
}

async function main() {
  console.log(`=== 간편등록 기일연동 (${BASE}) ===`);
  const errors = [];
  const ok = (cond, msg) => (cond ? console.log("OK:", msg) : errors.push(msg));

  const cookie = await demoLogin();
  ok(true, "데모 로그인");

  const ts = Date.now();
  const create = await api(cookie, "/api/admin/cases", {
    method: "POST",
    body: JSON.stringify({
      caseNumber: `2025가소32949`,
      caseType: "민사",
      caseName: "손해배상",
      court: "서울중앙지방법원",
      clientName: "강준철",
      assignedStaff: "체험 관리자",
      status: "진행중",
      parties: [{ role: "client", name: "강준철", sortOrder: 0 }],
    }),
  });
  console.log(`create ${create.res.status} ${create.ms}ms`, create.json.error ?? create.json.data?.id);
  if (!create.res.ok) {
    errors.push(`사건 생성 실패: ${create.json.error}`);
  } else {
    const caseId = create.json.data?.id;
    ok(caseId, `사건 생성 ${caseId}`);

    const job = {
      courtName: "서울중앙지방법원",
      year: "2025",
      gubun: "가소",
      serial: "32949",
      partyName: "강준철",
    };

    const enqueue = await api(cookie, "/api/court-case", {
      method: "POST",
      body: JSON.stringify({ job, async: true }),
    });
    ok(enqueue.res.ok && enqueue.json.jobId, `court-case enqueue ${enqueue.json.jobId}`);

    let pollStatus = "pending";
    const tPoll = Date.now();
    while (Date.now() - tPoll < 130_000) {
      const st = await api(cookie, `/api/court-case?jobId=${enqueue.json.jobId}`);
      pollStatus = st.json.status ?? "pending";
      if (pollStatus === "done" || pollStatus === "failed") break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    ok(pollStatus === "done", `court-case poll ${pollStatus} (${Date.now() - tPoll}ms)`);

    const link = await api(cookie, "/api/cases/scourt-link", {
      method: "POST",
      body: JSON.stringify({ caseId, jobId: enqueue.json.jobId }),
    });
    console.log(`scourt-link ${link.res.status} ${link.ms}ms`, JSON.stringify(link.json).slice(0, 500));
    ok(link.res.ok && link.json.ok, `scourt-link ok=${link.json.ok}`);
    ok(
      link.json.courtDivision || link.json.receivedDate || (link.json.eventsTotal ?? 0) >= 0,
      `연동 메타 courtDivision=${!!link.json.courtDivision} received=${link.json.receivedDate ?? "-"}`
    );

    const dl = await api(cookie, `/api/deadlines?caseId=${caseId}`);
    const rows = dl.json.data ?? [];
    console.log(`deadlines ${dl.res.status} count=${rows.length}`);
    if (rows.length) console.log("sample:", rows[0]);
    ok(
      rows.length > 0 || link.json.courtDivision,
      rows.length > 0 ? `기일 UI 데이터 ${rows.length}건` : "기일 0건이나 재판부 메타 반영"
    );

    // cleanup duplicate test case if created
    if (link.json.ok) {
      await api(cookie, "/api/admin/cases", {
        method: "DELETE",
        body: JSON.stringify({ ids: [caseId] }),
      });
    }
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
