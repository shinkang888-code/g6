/**
 * POST /api/auth/google/setup — Google OAuth Client ID/Secret 저장
 * GET  — 설정 상태 (리디렉션 URI, bootstrap 가능 여부)
 *
 * 미설정 시: 누구나 최초 1회 등록 가능 (bootstrap)
 * 설정 후: 관리자만 변경 가능
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import { mergeEnvLocal } from "@/lib/envLocalFile";
import { getAppSetting, setAppSetting } from "@/lib/appSettingsServer";
import {
  GOOGLE_OAUTH_SETTINGS_KEY,
  getGoogleOAuthCredentials,
  isGoogleAuthEnabled,
  type GoogleOAuthSettings,
} from "@/lib/googleAuthSettings";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN, LIMIT_AUTH_READ_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

function isAdminSession(session: Awaited<ReturnType<typeof getSession>>): boolean {
  if (!session) return false;
  if ((session.role ?? "").trim() === "관리자") return true;
  const perms = session.menuPermissions ?? [];
  return perms.includes("*") || perms.includes("관리자");
}

function envLocked(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:google-setup:${getClientIdentifier(request)}`,
    LIMIT_AUTH_READ_PER_MIN,
    { routePath: "/api/auth/google/setup", source: "auth" }
  );
  if (limited) return limited;

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
  const configured = await isGoogleAuthEnabled();
  const creds = await getGoogleOAuthCredentials();
  const fromEnv = envLocked();

  let clientIdHint = "";
  if (fromEnv) {
    clientIdHint = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  } else {
    const stored = await getAppSetting<GoogleOAuthSettings>(GOOGLE_OAUTH_SETTINGS_KEY);
    clientIdHint = stored?.clientId?.trim() ?? "";
  }

  return NextResponse.json({
    configured,
    canEdit: !fromEnv,
    credentialsFromEnv: fromEnv,
    source: creds.source,
    redirectUri,
    clientIdHint: clientIdHint ? `${clientIdHint.slice(0, 12)}…` : "",
    bootstrapAllowed: !configured && !fromEnv,
  });
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:google-setup-post:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/auth/google/setup", source: "auth" }
  );
  if (limited) return limited;

  if (envLocked()) {
    return NextResponse.json(
      {
        error:
          "환경 변수(GOOGLE_OAUTH_CLIENT_ID/SECRET)로 이미 고정되어 있습니다. Vercel 대시보드에서 수정하세요.",
      },
      { status: 400 }
    );
  }

  const configured = await isGoogleAuthEnabled();
  const session = await getSession();

  if (configured && !isAdminSession(session)) {
    return NextResponse.json(
      { error: "Google OAuth가 이미 설정되어 있습니다. 관리자만 변경할 수 있습니다." },
      { status: 403 }
    );
  }

  let body: { clientId?: string; clientSecret?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const clientId = (body.clientId ?? "").trim();
  const clientSecret = (body.clientSecret ?? "").trim();
  const existing = (await getAppSetting<GoogleOAuthSettings>(GOOGLE_OAUTH_SETTINGS_KEY)) ?? {};

  if (!clientId) {
    return NextResponse.json({ error: "Client ID를 입력하세요." }, { status: 400 });
  }

  let secret = existing.clientSecret?.trim() ?? "";
  if (clientSecret) {
    secret = clientSecret;
  } else if (!configured && !secret) {
    return NextResponse.json({ error: "Client Secret을 입력하세요." }, { status: 400 });
  }

  const next: GoogleOAuthSettings = {
    clientId,
    clientSecret: secret,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
  };

  const ok = await setAppSetting(GOOGLE_OAUTH_SETTINGS_KEY, next);
  if (!ok) {
    return NextResponse.json({ error: "DB에 저장하지 못했습니다. Supabase 연결을 확인하세요." }, { status: 503 });
  }

  if (process.env.NODE_ENV === "development") {
    try {
      await mergeEnvLocal({
        GOOGLE_OAUTH_CLIENT_ID: clientId,
        GOOGLE_OAUTH_CLIENT_SECRET: secret,
      });
    } catch {
      // .env.local 실패해도 DB 저장은 유지
    }
  }

  const enabled = await isGoogleAuthEnabled();

  return NextResponse.json({
    success: true,
    configured: enabled,
    message: configured
      ? "Google OAuth 설정이 업데이트되었습니다."
      : "Google OAuth가 등록되었습니다. Google 로그인 버튼을 사용할 수 있습니다.",
  });
}
