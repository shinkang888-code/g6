/**
 * Google OAuth 시작 — GET ?mode=login|signup
 */

import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  getGoogleRedirectUri,
  type GoogleAuthMode,
} from "@/lib/googleAuth";
import { isGoogleAuthEnabled } from "@/lib/googleAuthSettings";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:google:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/auth/google", source: "auth" }
  );
  if (limited) return limited;

  const enabled = await isGoogleAuthEnabled();
  if (!enabled) {
    const origin = request.nextUrl.origin;
    const url = new URL("/login", origin);
    url.searchParams.set("google_error", "not_configured");
    url.searchParams.set(
      "google_message",
      "Google 로그인이 설정되지 않았습니다. 관리자에게 OAuth Client ID/Secret 설정을 요청하세요."
    );
    return NextResponse.redirect(url);
  }

  const modeParam = request.nextUrl.searchParams.get("mode");
  const mode: GoogleAuthMode = modeParam === "signup" ? "signup" : "login";
  const redirectUri = getGoogleRedirectUri(request.nextUrl.origin);
  const url = await buildGoogleAuthUrl(redirectUri, mode);

  if (!url) {
    return NextResponse.json({ error: "Google OAuth 클라이언트를 초기화할 수 없습니다." }, { status: 503 });
  }

  return NextResponse.redirect(url);
}
