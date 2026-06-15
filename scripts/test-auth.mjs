/**
 * 회원가입 → 로그인 연동 점검 (개발 서버가 떠 있어야 함)
 * 사용: node scripts/test-auth.mjs
 *       BASE_URL=http://localhost:3080 node scripts/test-auth.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const loginId = "testauth-" + Date.now();
const password = "test1234";
const managementNumber = "00000";

async function run() {
  console.log("1. 회원가입:", loginId, managementNumber);
  const signRes = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password, managementNumber, name: "테스트" }),
  });
  const signData = await signRes.json().catch(() => ({}));
  if (!signRes.ok) {
    console.error("회원가입 실패:", signRes.status, signData.error || signData);
    process.exit(1);
  }
  console.log("   →", signData.message || "OK");

  console.log("2. 로그인:", loginId);
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password, managementNumber }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  if (loginRes.ok) {
    console.log("   → 로그인 성공, user:", loginData.user?.loginId);
    console.log("\n점검 완료: 회원가입·로그인 정상 동작");
    return;
  }
  if (loginRes.status === 403 && loginData.error?.includes("승인")) {
    console.log("   → 승인 대기 중 (의도된 동작). 관리자 승인 후 로그인 가능.");
    console.log("\n점검 완료: 회원가입 정상, 로그인은 승인 후 가능");
    return;
  }
  console.error("로그인 실패:", loginRes.status, loginData.error || loginData);
  process.exit(1);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
