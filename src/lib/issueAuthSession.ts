/**
 * 로그인 성공 시 세션 쿠키 발급 (동시 로그인 정책 반영)
 */
import crypto from "crypto";
import { createSessionCookie, type SessionPayload } from "@/lib/authSession";
import { registerActiveSession } from "@/lib/activeSessionStore";
import { allowsConcurrentLogin } from "@/lib/concurrentLoginPolicy";

export function issueAuthSessionCookie(
  base: Omit<SessionPayload, "sessionId"> & Partial<Pick<SessionPayload, "sessionId">>,
  identity?: {
    loginId?: string;
    managementNumber?: string;
    googleEmail?: string | null;
  }
): string {
  const concurrent = allowsConcurrentLogin({
    userId: base.userId,
    loginId: identity?.loginId ?? base.loginId,
    managementNumber: identity?.managementNumber ?? base.managementNumber,
    googleEmail: identity?.googleEmail,
  });

  const sessionId = base.sessionId ?? crypto.randomUUID();
  registerActiveSession(base.userId, sessionId, concurrent);

  const payload: SessionPayload = {
    ...base,
    sessionId,
    allowConcurrentLogin: concurrent,
  };

  return createSessionCookie(payload);
}
