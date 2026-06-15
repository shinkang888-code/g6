/**
 * Google Drive 자료실 설정 (전체관리자·전체부관리자)
 * GET — 마스킹된 설정 + 연결 상태
 * PUT — 서비스 계정 JSON(base64)·루트 폴더·사용 여부 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { getAppSetting, setAppSetting } from "@/lib/appSettingsServer";
import { DRIVE_SETTINGS_KEY, type DriveSettings, getDriveSettings } from "@/lib/driveSettings";
import { serviceAccountEmailFromBase64 } from "@/lib/driveServiceAccount";
import {
  getDriveServiceAccountEmail,
  isDriveAvailable,
  resetDriveAuthCache,
} from "@/lib/googleDriveClient";

async function loadStoredSettings(): Promise<DriveSettings> {
  return getDriveSettings();
}

export async function GET() {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const fromDb = (await getAppSetting<DriveSettings>(DRIVE_SETTINGS_KEY)) ?? {};
  const stored = await loadStoredSettings();
  const fromEnv = Boolean(process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64?.trim());
  const hasStoredCredentials = Boolean(stored.credentialsBase64);
  const hasOAuthUpload = Boolean(stored.oauthRefreshToken?.trim());
  const configured = hasStoredCredentials || hasOAuthUpload;
  const available = hasOAuthUpload && Boolean(stored.rootFolderId?.trim())
    ? await isDriveAvailable()
    : false;
  const serviceAccountEmail = configured
    ? (await getDriveServiceAccountEmail()) ??
      (stored.credentialsBase64
        ? serviceAccountEmailFromBase64(stored.credentialsBase64)
        : null)
    : null;

  return NextResponse.json({
    enabled: stored.enabled !== false,
    rootFolderId: stored.rootFolderId ?? "",
    hasStoredCredentials,
    credentialsFromEnv: fromEnv && !fromDb.preferDbOverEnv,
    preferDbOverEnv: Boolean(fromDb.preferDbOverEnv),
    canOverrideEnv: fromEnv,
    serviceAccountEmail,
    oauthConnected: hasOAuthUpload,
    oauthDelegateEmail: stored.oauthDelegateEmail ?? null,
    configured,
    available,
    hint: !hasStoredCredentials
      ? "서비스 계정 JSON 키를 업로드한 뒤 저장하세요."
      : !stored.rootFolderId?.trim()
        ? "루트 폴더 ID를 입력하세요. (shinkang888@gmail.com Drive의 lawygo 폴더)"
        : !hasOAuthUpload
          ? "서비스 계정만으로는 파일 업로드가 불가합니다. 아래 「업로드 권한 연결(OAuth)」을 shinkang888@gmail.com 계정으로 완료하세요."
          : !available
            ? "OAuth는 연결되었으나 루트 폴더 접근에 실패했습니다. 폴더 ID·공유 권한을 확인하세요."
            : null,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  let body: {
    credentialsBase64?: string;
    removeCredentials?: boolean;
    rootFolderId?: string;
    enabled?: boolean;
    overrideEnv?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const envLocked = Boolean(process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64?.trim());
  if (envLocked && !body.overrideEnv) {
    return NextResponse.json(
      {
        error:
          "환경 변수 GOOGLE_DRIVE_CREDENTIALS_BASE64가 설정되어 있습니다. 「환경 변수 키 교체」를 누른 뒤 새 키를 업로드·저장하세요.",
        code: "ENV_LOCKED",
      },
      { status: 400 }
    );
  }

  const existing = (await getAppSetting<DriveSettings>(DRIVE_SETTINGS_KEY)) ?? {};

  let credentialsBase64 = existing.credentialsBase64;
  if (body.removeCredentials) {
    credentialsBase64 = undefined;
  } else if (body.credentialsBase64?.trim()) {
    const email = serviceAccountEmailFromBase64(body.credentialsBase64.trim());
    if (!email) {
      return NextResponse.json(
        { error: "저장할 수 없는 서비스 계정 키입니다. client_email·private_key를 확인하세요." },
        { status: 400 }
      );
    }
    credentialsBase64 = body.credentialsBase64.trim();
  }

  const preferDbOverEnv =
    body.overrideEnv === true ||
    existing.preferDbOverEnv === true ||
    Boolean(body.credentialsBase64?.trim());

  const next: DriveSettings = {
    credentialsBase64,
    rootFolderId:
      body.rootFolderId !== undefined ? body.rootFolderId.trim() || undefined : existing.rootFolderId,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled !== false,
    preferDbOverEnv,
    oauthRefreshToken: existing.oauthRefreshToken,
    oauthDelegateEmail: existing.oauthDelegateEmail,
  };

  const ok = await setAppSetting(DRIVE_SETTINGS_KEY, next);
  if (!ok) {
    return NextResponse.json({ error: "DB에 설정을 저장하지 못했습니다." }, { status: 503 });
  }

  resetDriveAuthCache();

  const configured = Boolean(next.credentialsBase64) || Boolean(next.oauthRefreshToken);
  const available = Boolean(next.oauthRefreshToken) ? await isDriveAvailable() : false;

  return NextResponse.json({
    success: true,
    hasStoredCredentials: configured,
    preferDbOverEnv,
    serviceAccountEmail:
      configured && next.credentialsBase64
        ? serviceAccountEmailFromBase64(next.credentialsBase64)
        : null,
    available,
  });
}
