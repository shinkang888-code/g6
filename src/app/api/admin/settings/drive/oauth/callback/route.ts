/**
 * Drive OAuth 콜백 — refresh token 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/appSettingsServer";
import { DRIVE_SETTINGS_KEY, type DriveSettings } from "@/lib/driveSettings";
import { exchangeDriveOAuthCode, verifyDriveOAuthState } from "@/lib/driveOAuth";
import { resetDriveAuthCache } from "@/lib/googleDriveClient";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const err = request.nextUrl.searchParams.get("error");
  const settingsUrl = `${origin}/admin/settings/drive`;

  if (err) {
    return NextResponse.redirect(`${settingsUrl}?drive_oauth=denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?drive_oauth=invalid`);
  }

  const verified = verifyDriveOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(`${settingsUrl}?drive_oauth=invalid_state`);
  }

  const tokens = await exchangeDriveOAuthCode(origin, code);
  if (!tokens) {
    return NextResponse.redirect(`${settingsUrl}?drive_oauth=no_refresh`);
  }

  const existing = (await getAppSetting<DriveSettings>(DRIVE_SETTINGS_KEY)) ?? {};
  const next: DriveSettings = {
    ...existing,
    oauthRefreshToken: tokens.refreshToken,
    oauthDelegateEmail: tokens.email,
    enabled: existing.enabled !== false,
  };

  const ok = await setAppSetting(DRIVE_SETTINGS_KEY, next);
  if (!ok) {
    return NextResponse.redirect(`${settingsUrl}?drive_oauth=save_failed`);
  }

  resetDriveAuthCache();
  return NextResponse.redirect(`${settingsUrl}?drive_oauth=success&email=${encodeURIComponent(tokens.email)}`);
}
