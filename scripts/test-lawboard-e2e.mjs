/**
 * LawBoard E2E — 로그인 및 Phase1~3 API 검증
 * node scripts/test-lawboard-e2e.mjs [--base=https://lawboard.vercel.app]
 */
const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ||
  process.env.BASE_URL ||
  "https://lawboard.vercel.app"
).replace(/\/$/, "");

const LOGIN_ID = process.env.LAWBOARD_ADMIN_LOGIN_ID || "lawboardadmin";
const PASSWORD = process.env.LAWBOARD_ADMIN_PASSWORD || "LawBoard2026!";
const MANAGEMENT_NUMBER = process.env.LAWBOARD_ADMIN_MN || "10000";

const errors = [];
function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

function parseCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const lines = raw.length ? raw : [res.headers.get("set-cookie")].filter(Boolean);
  return lines.map((c) => String(c).split(";")[0]).join("; ");
}

console.log(`LawBoard E2E: ${BASE}\n`);

// 1. Login
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ loginId: LOGIN_ID, password: PASSWORD, managementNumber: MANAGEMENT_NUMBER }),
});
const loginJson = await loginRes.json().catch(() => ({}));
const cookie = parseCookie(loginRes);
check("로그인 성공", loginRes.ok, loginJson.error || `status ${loginRes.status}`);
check("세션 쿠키 발급", cookie.length > 0);

if (!loginRes.ok) {
  console.error("\n로그인 실패 — 이후 테스트 중단");
  console.error(loginJson);
  process.exit(1);
}

const authHeaders = { Cookie: cookie };

// 2. Session
const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: authHeaders });
const sessionJson = await sessionRes.json().catch(() => ({}));
check("세션 조회", sessionRes.ok && sessionJson.user?.loginId === LOGIN_ID);
check("사내관리자 권한", sessionJson.user?.isCompanyAdmin === true);

// 3. Board (native)
const boardRes = await fetch(`${BASE}/api/board`, { headers: authHeaders });
const boardJson = await boardRes.json().catch(() => ({}));
check("게시판 목록 API", boardRes.ok && boardJson.success);
check("Supabase 네이티브 게시판", boardJson.nativeBoard === true);

// 4. Notices
const noticesRes = await fetch(`${BASE}/api/notices`, { headers: authHeaders });
const noticesJson = await noticesRes.json().catch(() => ({}));
check("공지 API", noticesRes.ok);

// 5. Consultations
const consultRes = await fetch(`${BASE}/api/consultations`, { headers: authHeaders });
const consultJson = await consultRes.json().catch(() => ({}));
check("상담 API", consultRes.ok && consultJson.success !== false);

// 6. Consultation rooms
const roomsRes = await fetch(`${BASE}/api/consultation-rooms`, { headers: authHeaders });
check("상담실 API", roomsRes.ok);

// 7. Mail
const mailRes = await fetch(`${BASE}/api/mail`, { headers: authHeaders });
const mailJson = await mailRes.json().catch(() => ({}));
check("메일 API", mailRes.ok && mailJson.success);

// 8. Tax documents
const taxRes = await fetch(`${BASE}/api/finance/tax-documents`, { headers: authHeaders });
check("세금계산서 API", taxRes.ok);

// 9. Admin users (tenant scope)
const usersRes = await fetch(`${BASE}/api/admin/users?view=active`, { headers: authHeaders });
const usersJson = await usersRes.json().catch(() => ({}));
check("사용자 관리 API", usersRes.ok, usersJson.error);

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\nLawBoard E2E 검증 통과");
