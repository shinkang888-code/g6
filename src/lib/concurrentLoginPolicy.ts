/**
 * 동시(중복) 로그인 정책 — 체험판 사내관리자 계정은 여러 기기·브라우저 동시 접속 허용
 */
import {
  DEMO_GOOGLE_EMAIL,
  DEMO_LOGIN_ID,
  DEMO_MANAGEMENT_NUMBER,
} from "@/lib/demoAuth";

export type ConcurrentLoginIdentity = {
  userId?: string;
  loginId?: string;
  managementNumber?: string;
  googleEmail?: string | null;
};

function normEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function normLogin(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** 체험판(10000) shinkang888@gmail.com 사내관리자 — 중복 로그인 허용 */
export function allowsConcurrentLogin(identity: ConcurrentLoginIdentity): boolean {
  const mn = (identity.managementNumber ?? "").trim();
  if (mn !== DEMO_MANAGEMENT_NUMBER) return false;

  const login = normLogin(identity.loginId);
  const email = normEmail(identity.googleEmail);
  const demoEmail = normEmail(DEMO_GOOGLE_EMAIL);
  const demoLogin = normLogin(DEMO_LOGIN_ID);
  const demoLocal = demoEmail.includes("@") ? demoEmail.split("@")[0]! : demoLogin;

  return (
    login === demoLogin ||
    login === demoEmail ||
    login === demoLocal ||
    email === demoEmail
  );
}
