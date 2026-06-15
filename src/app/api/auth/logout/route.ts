/**
 * 로그아웃: 세션 쿠키 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/authSession";
import { revokeActiveSession } from "@/lib/activeSessionStore";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:logout:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/auth/logout", source: "auth" }
  );
  if (limited) return limited;

  const session = await getSession();
  if (session) {
    revokeActiveSession(session.userId, session.sessionId);
  }

  const cookie = await deleteSession();
  const res = NextResponse.json({ success: true });
  res.headers.set("Set-Cookie", cookie);
  return res;
}
