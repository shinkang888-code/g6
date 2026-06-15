/**
 * Google OAuth UI·설정 API 점검
 * 사용: node scripts/test-google-auth.mjs
 *       BASE_URL=http://localhost:3080 node scripts/test-google-auth.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  return { res, text };
}

async function run() {
  console.log("BASE:", BASE);

  console.log("\n1. GET /api/auth/google/config");
  const cfgRes = await fetch(`${BASE}/api/auth/google/config`);
  const cfg = await cfgRes.json().catch(() => ({}));
  if (!cfgRes.ok) {
    console.error("   실패:", cfgRes.status, cfg);
    process.exit(1);
  }
  console.log("   enabled:", cfg.enabled, "| source:", cfg.source);
  if (!("redirectUri" in cfg)) {
    console.error("   redirectUri 필드 누락");
    process.exit(1);
  }
  console.log("   redirectUri:", cfg.redirectUri);

  console.log("\n2. 로그인 페이지에 Google 버튼 문구 포함 여부");
  const login = await fetchText("/login");
  if (!login.res.ok) {
    console.error("   /login 로드 실패:", login.res.status);
    process.exit(1);
  }
  const loginHasGoogle =
    login.text.includes("Google 계정으로 로그인") ||
    login.text.includes("GoogleAuthButton");
  if (!loginHasGoogle) {
    console.error("   로그인 페이지에 Google UI가 없습니다.");
    process.exit(1);
  }
  console.log("   → Google 로그인 UI 표시됨");

  console.log("\n3. 회원가입 페이지에 Google 버튼 문구 포함 여부");
  const signup = await fetchText("/login/signup");
  if (!signup.res.ok) {
    console.error("   /login/signup 로드 실패:", signup.res.status);
    process.exit(1);
  }
  const signupHasGoogle =
    signup.text.includes("Google 계정으로 가입하기") ||
    signup.text.includes("GoogleAuthButton");
  if (!signupHasGoogle) {
    console.error("   회원가입 페이지에 Google UI가 없습니다.");
    process.exit(1);
  }
  console.log("   → Google 가입 UI 표시됨");

  console.log("\n4. GET /api/auth/google (미설정 시 안내 리다이렉트)");
  const oauthRes = await fetch(`${BASE}/api/auth/google?mode=signup`, { redirect: "manual" });
  if (cfg.enabled) {
    if (oauthRes.status !== 302 && oauthRes.status !== 307) {
      console.error("   OAuth 시작이 리다이렉트가 아님:", oauthRes.status);
      process.exit(1);
    }
    const loc = oauthRes.headers.get("location") ?? "";
    if (!loc.includes("accounts.google.com")) {
      console.error("   Google OAuth URL이 아님:", loc.slice(0, 80));
      process.exit(1);
    }
    console.log("   → Google OAuth 리다이렉트 정상");
  } else {
    if (oauthRes.status !== 302 && oauthRes.status !== 307) {
      console.error("   미설정 시 /login 리다이렉트 기대, 실제:", oauthRes.status);
      process.exit(1);
    }
    const loc = oauthRes.headers.get("location") ?? "";
    if (!loc.includes("google_error=not_configured")) {
      console.error("   not_configured 리다이렉트 아님:", loc);
      process.exit(1);
    }
    console.log("   → 미설정 시 안내 리다이렉트 정상");
  }

  console.log("\n점검 완료: Google OAuth UI·설정 API 정상");
  if (!cfg.enabled) {
    console.log(
      "\n참고: OAuth가 비활성입니다. GOOGLE_OAUTH_CLIENT_ID/SECRET 환경 변수 또는",
      "관리자 > Google OAuth 설정에서 Client ID/Secret을 등록하면 버튼이 동작합니다."
    );
  }
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
