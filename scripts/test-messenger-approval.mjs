/**
 * 사내 메신저·전자결재 API 통합 테스트
 * 사용: node scripts/test-messenger-approval.mjs [baseUrl]
 */

const BASE = process.argv[2] || process.env.LAWYGO_URL || "http://localhost:3000";

async function loginAsDemo() {
  const res = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `로그인 실패 ${res.status}`);
  return { cookie, user: json.user };
}

async function api(path, cookie, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  console.log(`=== LawyGo 메신저·결재 테스트 (${BASE}) ===\n`);
  const results = [];

  let cookie;
  let user;
  try {
    ({ cookie, user } = await loginAsDemo());
    results.push({ name: "데모 로그인", ok: true });
    console.log("✓ 로그인:", user?.name ?? user?.loginId);
  } catch (e) {
    results.push({ name: "데모 로그인", ok: false, error: e.message });
    console.error("✗ 로그인 실패:", e.message);
    printSummary(results);
    process.exit(1);
  }

  const { res: staffRes, json: staffJson } = await api("/api/staff", cookie);
  const staff = staffJson.staff ?? [];
  results.push({ name: "직원 목록", ok: staffRes.ok && staff.length > 0 });
  console.log(staffRes.ok ? `✓ 직원 ${staff.length}명` : "✗ 직원 목록 실패");

  const recipient = staff.find((s) => s.id !== user.id && s.id !== user.userId) ?? staff[0];
  if (!recipient) {
    results.push({ name: "메신저 발송", ok: false, error: "수신자 없음" });
  } else {
    const { res: msgRes, json: msgJson } = await api("/api/internal-messages", cookie, {
      method: "POST",
      body: JSON.stringify({
        recipients: [
          {
            recipientId: recipient.id,
            recipientName: recipient.name,
            recipientLoginId: recipient.loginId,
          },
        ],
        body: `[테스트] 사내 메신저 ${new Date().toISOString()}`,
      }),
    });
    results.push({ name: "메신저 발송", ok: msgRes.ok, error: msgJson.error });
    console.log(msgRes.ok ? "✓ 메신저 발송" : `✗ 메신저: ${msgJson.error}`);

    const { res: inboxRes, json: inboxJson } = await api("/api/internal-messages?box=sent", cookie);
    results.push({ name: "메신저 조회", ok: inboxRes.ok });
    console.log(inboxRes.ok ? `✓ 발신함 ${inboxJson.data?.length ?? 0}건` : "✗ 메신저 조회 실패");
  }

  const approvers = staff.filter((s) => s.id !== user.id).slice(0, 2);
  if (approvers.length < 2) {
    results.push({ name: "결재 기안", ok: false, error: "결재자 2명 이상 필요" });
    console.log("✗ 결재 기안: 결재자 부족");
  } else {
    const approvalLine = [
      {
        order: 1,
        staffId: approvers[0].id,
        staffName: approvers[0].name,
        role: approvers[0].role,
        status: "대기",
      },
      {
        order: 2,
        staffId: approvers[1].id,
        staffName: approvers[1].name,
        role: approvers[1].role,
        status: "대기",
      },
    ];
    const { res: draftRes, json: draftJson } = await api("/api/approvals", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: `[테스트] 전자결재 ${Date.now()}`,
        type: "기타",
        approvalLine,
        notes: "자동 테스트 기안",
        referrerNames: ["참조자"],
      }),
    });
    results.push({ name: "결재 기안", ok: draftRes.ok, error: draftJson.error });
    console.log(draftRes.ok ? "✓ 결재 기안" : `✗ 기안: ${draftJson.error}`);

    if (draftRes.ok && draftJson.data?.id) {
      const docId = draftJson.data.id;
      const { res: detailRes, json: detailJson } = await api(`/api/approvals/${docId}`, cookie);
      results.push({
        name: "결재 상세·이력",
        ok: detailRes.ok && Array.isArray(detailJson.history),
      });
      console.log(
        detailRes.ok
          ? `✓ 상세·이력 ${detailJson.history?.length ?? 0}건`
          : `✗ 상세: ${detailJson.error}`
      );

      const { res: listRes, json: listJson } = await api("/api/approvals", cookie);
      const list = listJson.data ?? [];
      const byStatus = {
        결재요청: list.filter((d) => d.status === "결재요청").length,
        결재중: list.filter((d) => d.status === "결재중").length,
        완료: list.filter((d) => d.status === "결재완료" || d.status === "반려").length,
      };
      results.push({
        name: "결재 목록 탭",
        ok: listRes.ok && list.some((d) => d.id === docId),
      });
      console.log(
        listRes.ok
          ? `✓ 목록 ${list.length}건 (요청 ${byStatus.결재요청} / 진행 ${byStatus.결재중} / 완료 ${byStatus.완료})`
          : `✗ 목록: ${listJson.error}`
      );
    }
  }

  const { res: notiRes, json: notiJson } = await api("/api/notifications", cookie);
  results.push({ name: "알림 조회", ok: notiRes.ok });
  console.log(notiRes.ok ? `✓ 알림 ${notiJson.data?.length ?? 0}건` : "✗ 알림 조회 실패");

  const { res: statusRes, json: statusJson } = await api("/api/drive/status", cookie);
  results.push({ name: "Drive 상태", ok: statusRes.ok });
  console.log(statusRes.ok ? `✓ Drive 상태 (configured=${statusJson.configured})` : "✗ Drive 상태");

  printSummary(results);
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary(results) {
  console.log("\n=== 요약 ===");
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.error ? ` — ${r.error}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
