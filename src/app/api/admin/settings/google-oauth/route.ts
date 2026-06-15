/**
 * Google OAuth 로그인·가입 설정 (전체관리자·전체부관리자)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { getAppSetting, setAppSetting } from "@/lib/appSettingsServer";
import {
  GOOGLE_OAUTH_SETTINGS_KEY,
  type GoogleOAuthSettings,
  getGoogleOAuthCredentials,
  isGoogleAuthEnabled,
} from "@/lib/googleAuthSettings";

function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `••••${secret.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const fromEnv = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
  const stored = (await getAppSetting<GoogleOAuthSettings>(GOOGLE_OAUTH_SETTINGS_KEY)) ?? {};
  const creds = await getGoogleOAuthCredentials();
  const enabled = await isGoogleAuthEnabled();
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin.replace(/\/$/, "")}/api/auth/google/callback`;

  return NextResponse.json({
    enabled: stored.enabled !== false,
    configured: enabled,
    credentialsFromEnv: fromEnv && !stored.preferDbOverEnv,
    preferDbOverEnv: Boolean(stored.preferDbOverEnv),
    canOverrideEnv: fromEnv,
    source: creds.source,
    clientId: creds.clientId || stored.clientId?.trim() || "",
    clientSecretMasked: maskSecret(creds.clientSecret || stored.clientSecret?.trim() || ""),
    hasStoredSecret: Boolean(stored.clientSecret?.trim()),
    redirectUri,
    hint: enabled
      ? "로그인·회원가입 화면에서 Google 버튼이 활성화됩니다."
      : "Client ID와 Client Secret을 등록하세요. Google Cloud Console에서 승인된 리디렉션 URI에 아래 주소를 추가해야 합니다.",
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  let body: {
    clientId?: string;
    clientSecret?: string;
    enabled?: boolean;
    clearSecret?: boolean;
    overrideEnv?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const envLocked = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
  if (envLocked && !body.overrideEnv) {
    return NextResponse.json(
      {
        error:
          "환경 변수 GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET가 설정되어 있습니다. 「환경 변수 키 교체」 후 저장하세요.",
        code: "ENV_LOCKED",
      },
      { status: 400 }
    );
  }

  const existing = (await getAppSetting<GoogleOAuthSettings>(GOOGLE_OAUTH_SETTINGS_KEY)) ?? {};

  const clientId =
    body.clientId !== undefined ? body.clientId.trim() : existing.clientId?.trim() ?? "";
  let clientSecret = existing.clientSecret?.trim() ?? "";
  if (body.clearSecret) {
    clientSecret = "";
  } else if (body.clientSecret?.trim()) {
    clientSecret = body.clientSecret.trim();
  }

  if (clientId && !clientSecret && !existing.clientSecret?.trim()) {
    return NextResponse.json({ error: "Client Secret을 입력하세요." }, { status: 400 });
  }

  const preferDbOverEnv =
    body.overrideEnv === true ||
    existing.preferDbOverEnv === true ||
    Boolean(body.clientSecret?.trim());

  const next: GoogleOAuthSettings = {
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled !== false,
    preferDbOverEnv,
  };

  const ok = await setAppSetting(GOOGLE_OAUTH_SETTINGS_KEY, next);
  if (!ok) {
    return NextResponse.json({ error: "DB에 설정을 저장하지 못했습니다." }, { status: 503 });
  }

  const enabled = await isGoogleAuthEnabled();

  return NextResponse.json({
    success: true,
    configured: enabled,
    preferDbOverEnv,
    clientId: next.clientId ?? "",
    clientSecretMasked: maskSecret(next.clientSecret ?? ""),
    hasStoredSecret: Boolean(next.clientSecret),
  });
}
