/**
 * 간편등록 E2E — 사건 생성 + 나의사건검색 기일 연동
 * node scripts/test-quick-register-e2e.mjs
 * BASE_URL=https://lawygo.vercel.app node scripts/test-quick-register-e2e.mjs
 */
const BASE = process.env.BASE_URL || "https://lawygo.vercel.app";

/** 법원 최근기일 4건 확인된 검증용 사건 (대구 2025노5285) */
const SAMPLE = {
  caseNumber: "2025노5285",
  courtName: "대구지방법원",
  partyName: "이선아",
};

const job = {
  courtName: SAMPLE.courtName,
  year: "2025",
  gubun: "노",
  serial: "5285",
  partyName: SAMPLE.partyName,
};

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

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
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(opts.headers ?? {}),
    },
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

async function findCaseByNumber(cookie, caseNumber) {
  const { res, json } = await api(
    cookie,
    `/api/admin/cases?q=${encodeURIComponent(caseNumber)}&page=1&page_size=20`
  );
  if (!res.ok) return null;
  const rows = json.data ?? [];
  return rows.find((r) => (r.caseNumber ?? r.case_number) === caseNumber) ?? null;
}

async function createCase(cookie) {
  const payload = {
    caseNumber: SAMPLE.caseNumber,
    caseType: "민사",
    caseName: "민사",
    court: SAMPLE.courtName,
    trialLevel: "1심",
    clientName: SAMPLE.partyName,
    parties: [
      {
        role: "client",
        sortOrder: 0,
        name: SAMPLE.partyName,
      },
    ],
    assignedStaff: "체험 관리자",
    assistants: "신강",
    receivedDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    isElectronic: false,
    status: "진행중",
  };
  const { res, json } = await api(cookie, "/api/admin/cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { res, json };
}

async function fetchDeadlines(cookie, caseId) {
  const { res, json } = await api(cookie, `/api/deadlines?caseId=${encodeURIComponent(caseId)}`);
  const list = Array.isArray(json.data) ? json.data : [];
  return { res, json: list };
}

async function main() {
  console.log(`=== 간편등록 E2E (${BASE}) ===`);
  console.log("입력:", SAMPLE);

  const cookie = await demoLogin();
  console.log("OK: 데모 로그인");

  let caseId = "";
  let created = false;

  const existing = await findCaseByNumber(cookie, SAMPLE.caseNumber);
  if (existing) {
    caseId = String(existing.id ?? existing.caseId ?? "");
    console.log(`기존 사건 사용: ${caseId}`);
  } else {
    const { res, json } = await createCase(cookie);
    if (!res.ok) {
      throw new Error(`사건 생성 실패: ${json.error ?? res.status}`);
    }
    caseId = String(json.data?.id ?? "");
    created = true;
    assert(caseId, "생성된 caseId 없음");
    console.log(`OK: 사건 생성 ${caseId}`);
  }

  const before = await fetchDeadlines(cookie, caseId);
  const beforeCount = Array.isArray(before.json) ? before.json.length : 0;
  console.log(`기일(연동 전): ${beforeCount}건`);

  const { res: linkRes, json: linkJson } = await api(cookie, "/api/cases/scourt-link", {
    method: "POST",
    body: JSON.stringify({ caseId, job }),
  });

  console.log("scourt-link:", linkRes.status, JSON.stringify(linkJson));

  const { res: syncRes, json: syncJson } = await api(cookie, "/api/cases/sync-deadlines", {
    method: "POST",
    body: JSON.stringify({ caseId }),
  });

  console.log("sync-deadlines:", syncRes.status, JSON.stringify(syncJson));

  const syncOk = syncRes.ok && syncJson.ok === true;
  const linkOk = linkRes.ok && linkJson.ok === true;

  assert(syncOk || linkOk, `기일 연동 실패 — link: ${linkJson.error ?? linkRes.status}, sync: ${syncJson.error ?? syncRes.status}`);

  const after = await fetchDeadlines(cookie, caseId);
  const afterCount = Array.isArray(after.json) ? after.json.length : 0;
  console.log(`기일(연동 후): ${afterCount}건`);

  if (afterCount > 0) {
    const preview = after.json.slice(0, 3).map((d) => ({
      date: d.date ?? d.deadlineDate ?? d.deadline_date,
      type: d.type ?? d.deadlineType ?? d.deadline_type,
      court: d.court,
    }));
    console.log("기일 샘플:", preview);
  }

  const added = Number((syncJson.eventsAdded ?? linkJson.eventsAdded) ?? 0);
  const updated = Number((syncJson.eventsUpdated ?? linkJson.eventsUpdated) ?? 0);
  const unchanged = Number((syncJson.eventsUnchanged ?? linkJson.eventsUnchanged) ?? 0);
  const courtEvents = added + updated + unchanged;

  assert(
    afterCount > 0,
    `연동 후 기일 0건 (법원 ${courtEvents}건, API ${afterCount}건)`
  );
  assert(
    added > 0 || updated > 0 || unchanged > 0 || afterCount > beforeCount,
    "기일 변동 없음"
  );

  if (errors.length) {
    errors.forEach((e) => console.error("FAIL:", e));
    process.exit(1);
  }

  console.log("\n✅ 간편등록 E2E 통과");
  console.log({
    caseId,
    created,
    eventsAdded: added,
    eventsUpdated: updated,
    eventsUnchanged: unchanged,
    deadlineCount: afterCount,
  });
}

main().catch((e) => {
  console.error("\n❌ E2E 실패:", e.message || e);
  process.exit(1);
});
