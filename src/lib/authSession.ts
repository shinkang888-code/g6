/**
 * 서버 전용: 세션 쿠키 생성/검증
 */

import { cookies } from "next/headers";
import crypto from "crypto";
import { isActiveSession } from "@/lib/activeSessionStore";

const COOKIE_NAME = "lawygo_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7일

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    console.error("[authSession] SESSION_SECRET is required in production");
    return "";
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "lawygo-dev-only-secret";
}

export interface SessionPayload {
  userId: string;
  loginId: string;
  name: string;
  /** LawTop 관리번호 — 회사(테넌트) 격리 키 (active 와 동기화) */
  managementNumber?: string;
  /** DB 소속 관리번호 (전체관리자 홈) */
  homeManagementNumber?: string;
  /** 현재 작업 중인 관리번호 (전체관리자 전환) */
  activeManagementNumber?: string;
  role?: string;
  /** app_settings.roles.id — 메뉴 권한 */
  permissionRoleId?: string;
  menuPermissions?: string[];
  /** HDL 신원 확인 해시 레코드 ID (H_v) */
  hVId?: string;
  /** 서버 활성 세션 ID (중복 로그인 제어) */
  sessionId?: string;
  /** 체험판 사내관리자 등 동시 로그인 허용 계정 */
  allowConcurrentLogin?: boolean;
}

function encode(data: SessionPayload): string {
  const json = JSON.stringify(data);
  const encoded = Buffer.from(json, "utf-8").toString("base64url");
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function decode(token: string): SessionPayload | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const secret = getSessionSecret();
  if (!secret) return null;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "utf-8"), Buffer.from(expected, "utf-8"))) return null;
  } catch {
    return null;
  }
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

export function createSessionCookie(payload: SessionPayload): string {
  const token = encode(payload);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  const session = decode(cookie);
  if (!session) return null;

  if (session.allowConcurrentLogin) {
    return session;
  }

  if (!isActiveSession(session.userId, session.sessionId)) {
    return null;
  }

  return session;
}

export async function deleteSession(): Promise<string> {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
