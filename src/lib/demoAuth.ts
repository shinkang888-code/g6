import type { SessionPayload } from "@/lib/authSession";
import { ADMIN_ROLE_ID } from "@/lib/rolesSchema";

/** 체험판 DEMO 고정 계정 — 사내관리자(10000), 전체관리자 아님 */
export const DEMO_MANAGEMENT_NUMBER = process.env.DEMO_MANAGEMENT_NUMBER?.trim() || "10000";
export const DEMO_GOOGLE_EMAIL =
  process.env.DEMO_GOOGLE_EMAIL?.trim() || "shinkang888@gmail.com";
/** Google 가입 계정 login_id (shinkang 플랫폼 계정과 분리) */
export const DEMO_LOGIN_ID =
  process.env.DEMO_LOGIN_ID?.trim() || "shinkang888@gmail.com";
export const DEMO_PASSWORD = process.env.DEMO_INITIAL_PASSWORD ?? "Admin1234!";
export const DEMO_NAME = process.env.DEMO_NAME ?? "체험 사내관리자";

/** 프로덕션 포함 데모 로그인 API 허용 여부 (ENABLE_DEMO_LOGIN=false 로만 차단) */
export function isDemoLoginEnabled(): boolean {
  if (process.env.ENABLE_DEMO_LOGIN === "false") return false;
  if (process.env.NODE_ENV === "production") return process.env.ENABLE_DEMO_LOGIN === "true";
  return true;
}

/** DB 없이 로컬 개발용 데모 세션 (NODE_ENV=development 전용) */
export function isOfflineDemoAllowed(): boolean {
  return process.env.NODE_ENV === "development" && isDemoLoginEnabled();
}

export function buildOfflineDemoSession(): SessionPayload {
  return {
    userId: "local-demo-offline",
    loginId: DEMO_LOGIN_ID,
    name: DEMO_NAME,
    role: "관리자",
    managementNumber: DEMO_MANAGEMENT_NUMBER,
    homeManagementNumber: DEMO_MANAGEMENT_NUMBER,
    activeManagementNumber: DEMO_MANAGEMENT_NUMBER,
    permissionRoleId: ADMIN_ROLE_ID,
  };
}
