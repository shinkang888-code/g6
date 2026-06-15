import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthCredentials, isGoogleAuthEnabled } from "@/lib/googleAuthSettings";
import { getClientIdentifier, LIMIT_AUTH_READ_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:google-config:${getClientIdentifier(request)}`,
    LIMIT_AUTH_READ_PER_MIN,
    { routePath: "/api/auth/google/config", source: "auth" }
  );
  if (limited) return limited;

  const enabled = await isGoogleAuthEnabled();
  const creds = await getGoogleOAuthCredentials();
  const origin = request.nextUrl.origin;
  return NextResponse.json({
    enabled,
    source: creds.source,
    fromEnv: creds.source === "env",
    redirectUri: `${origin.replace(/\/$/, "")}/api/auth/google/callback`,
    setupHint: enabled
      ? null
      : "Google Cloud Console에서 OAuth 클라이언트를 만든 뒤, .env.local 또는 관리자 > Google OAuth 설정에 Client ID/Secret을 등록하세요.",
  });
}
