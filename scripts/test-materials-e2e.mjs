/**
 * 자료관리 E2E — Google Drive 검색·업로드·이름변경·다운로드·삭제
 * node scripts/test-materials-e2e.mjs
 * BASE_URL=https://lawygo.vercel.app node scripts/test-materials-e2e.mjs
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

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

async function main() {
  console.log(`=== 자료관리 E2E (${BASE}) ===`);

  const cookie = await demoLogin();
  console.log("OK: 데모 로그인");

  const status = await api(cookie, "/api/drive/status");
  console.log("Drive 상태:", status.res.status, JSON.stringify(status.json));
  if (!status.res.ok || !status.json?.available) {
    console.warn("Drive 미연동 — 일부 테스트 스킵");
  }

  const listBefore = await api(cookie, "/api/drive/company-files");
  assert(listBefore.res.ok, `목록 조회 실패: ${listBefore.json.error ?? listBefore.res.status}`);
  const beforeCount = listBefore.json.files?.length ?? 0;
  console.log(`목록(전): ${beforeCount}건`);

  const search = await api(cookie, "/api/drive/company-files?q=test");
  assert(search.res.ok, `검색 실패: ${search.json.error ?? search.res.status}`);
  console.log(`검색 'test': ${search.json.files?.length ?? 0}건`);

  const testName = `lawygo-materials-test-${Date.now()}.txt`;
  const testContent = `LawyGo materials E2E ${new Date().toISOString()}`;
  const blob = new Blob([testContent], { type: "text/plain" });
  const fd = new FormData();
  fd.append("file", blob, testName);

  const upload = await fetch(`${BASE}/api/drive/company-files/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: fd,
  });
  const uploadJson = await upload.json();
  assert(upload.ok && uploadJson.fileId, `업로드 실패: ${uploadJson.error ?? upload.status}`);
  const fileId = uploadJson.fileId;
  console.log("업로드:", fileId, uploadJson.name);

  const renamed = `renamed-${Date.now()}.txt`;
  const patch = await api(cookie, `/api/drive/company-files/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: renamed }),
  });
  assert(patch.res.ok && patch.json.ok, `이름변경 실패: ${patch.json.error ?? patch.res.status}`);
  console.log("이름변경:", renamed);

  const dl = await api(cookie, `/api/drive/company-files/download/${fileId}`);
  assert(dl.res.ok, `다운로드 실패: ${dl.res.status}`);
  const dlText = dl.json.raw ?? (typeof dl.json === "string" ? dl.json : "");
  if (dl.res.headers.get("content-type")?.includes("text")) {
    const body = await fetch(`${BASE}/api/drive/company-files/download/${fileId}`, {
      headers: { Cookie: cookie },
    }).then((r) => r.text());
    assert(body.includes("LawyGo materials E2E"), "다운로드 내용 불일치");
    console.log("다운로드: 내용 확인 OK");
  } else {
    console.log("다운로드: HTTP", dl.res.status, "(바이너리)");
  }

  const listAfterUpload = await api(cookie, `/api/drive/company-files?q=${encodeURIComponent(renamed)}`);
  const found = (listAfterUpload.json.files ?? []).some((f) => f.fileId === fileId);
  assert(found, "검색으로 업로드 파일 미발견");
  console.log("검색(변경명): 발견 OK");

  const del = await api(cookie, `/api/drive/company-files/${fileId}`, { method: "DELETE" });
  assert(del.res.ok && del.json.ok, `삭제 실패: ${del.json.error ?? del.res.status}`);
  console.log("삭제: OK");

  const listAfterDel = await api(cookie, `/api/drive/company-files?q=${encodeURIComponent(renamed)}`);
  const stillThere = (listAfterDel.json.files ?? []).some((f) => f.fileId === fileId);
  assert(!stillThere, "삭제 후에도 파일이 검색됨");
  console.log("삭제 확인: OK");

  if (errors.length) {
    errors.forEach((e) => console.error("FAIL:", e));
    process.exit(1);
  }

  console.log("\n✅ 자료관리 E2E 통과");
}

main().catch((e) => {
  console.error("\n❌ E2E 실패:", e.message || e);
  process.exit(1);
});
