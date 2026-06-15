/**
 * Drive OAuth 위임 시작
 * GET → Google consent (drive scope)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { buildDriveOAuthUrl } from "@/lib/driveOAuth";

export async function GET(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const origin = request.nextUrl.origin;
  const url = await buildDriveOAuthUrl(origin, auth.session.loginId);
  if (!url) {
    return NextResponse.json(
      { error: "Google OAuth Client ID/Secret이 설정되지 않았습니다. Google OAuth 설정을 먼저 완료하세요." },
      { status: 503 }
    );
  }

  return NextResponse.redirect(url);
}
