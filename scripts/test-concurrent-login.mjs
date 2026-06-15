/**
 * 체험판 사내관리자 중복 로그인 정책 검증
 * node scripts/test-concurrent-login.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function allowsConcurrentLogin(identity) {
  const DEMO_MANAGEMENT_NUMBER = "10000";
  const DEMO_GOOGLE_EMAIL = "shinkang888@gmail.com";
  const DEMO_LOGIN_ID = "shinkang888@gmail.com";

  const mn = (identity.managementNumber ?? "").trim();
  if (mn !== DEMO_MANAGEMENT_NUMBER) return false;

  const login = (identity.loginId ?? "").trim().toLowerCase();
  const email = (identity.googleEmail ?? "").trim().toLowerCase();
  const demoEmail = DEMO_GOOGLE_EMAIL.toLowerCase();
  const demoLogin = DEMO_LOGIN_ID.toLowerCase();
  const demoLocal = demoEmail.includes("@") ? demoEmail.split("@")[0] : demoLogin;

  return (
    login === demoLogin ||
    login === demoEmail ||
    login === demoLocal ||
    email === demoEmail
  );
}

const store = new Map();

function registerActiveSession(userId, sessionId, concurrent) {
  if (concurrent) {
    const set = store.get(userId) ?? new Set();
    set.add(sessionId);
    store.set(userId, set);
  } else {
    store.set(userId, new Set([sessionId]));
  }
}

function isActiveSession(userId, sessionId) {
  if (!sessionId) return true;
  const set = store.get(userId);
  if (!set) return true;
  return set.has(sessionId);
}

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

assert(
  allowsConcurrentLogin({
    loginId: "shinkang888@gmail.com",
    managementNumber: "10000",
  }),
  "trial admin allows concurrent"
);

assert(
  !allowsConcurrentLogin({
    loginId: "other@law.com",
    managementNumber: "10000",
  }),
  "non-demo user on 10000 blocked"
);

assert(
  !allowsConcurrentLogin({
    loginId: "shinkang888@gmail.com",
    managementNumber: "20000",
  }),
  "demo email wrong tenant blocked"
);

const userId = "trial-user-1";
registerActiveSession(userId, "sess-a", true);
registerActiveSession(userId, "sess-b", true);
assert(isActiveSession(userId, "sess-a") && isActiveSession(userId, "sess-b"), "concurrent sessions both active");

registerActiveSession(userId, "sess-c", false);
assert(isActiveSession(userId, "sess-c") && !isActiveSession(userId, "sess-a"), "single session replaces old");

const policy = readFileSync(resolve(root, "src/lib/concurrentLoginPolicy.ts"), "utf8");
const issue = readFileSync(resolve(root, "src/lib/issueAuthSession.ts"), "utf8");
const auth = readFileSync(resolve(root, "src/lib/authSession.ts"), "utf8");
const demo = readFileSync(resolve(root, "src/app/api/auth/demo/route.ts"), "utf8");

assert(policy.includes("allowsConcurrentLogin"), "policy module exists");
assert(issue.includes("registerActiveSession"), "issue session registers store");
assert(auth.includes("allowConcurrentLogin"), "session payload flag");
assert(demo.includes("issueAuthSessionCookie"), "demo uses issue helper");

const rateLimit = readFileSync(resolve(root, "src/lib/rateLimit.ts"), "utf8");
assert(rateLimit.includes("LIMIT_DEMO_PER_MIN = 60"), "demo rate limit raised");

if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("체험판 중복 로그인 정책 검증 통과");
