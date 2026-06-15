import { NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import {
  getDriveServiceAccountEmail,
  isDriveAvailable,
} from "@/lib/googleDriveClient";
import { getDriveSettings } from "@/lib/driveSettings";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const settings = await getDriveSettings();
  const hasOAuth = Boolean(settings.oauthRefreshToken?.trim());
  const configured = Boolean(settings.credentialsBase64) || hasOAuth;
  const available = hasOAuth ? await isDriveAvailable() : false;
  const serviceAccountEmail = settings.credentialsBase64 ? await getDriveServiceAccountEmail() : null;

  return NextResponse.json({
    configured,
    available,
    enabled: settings.enabled !== false,
    hasRootFolderId: Boolean(settings.rootFolderId),
    hasOAuthUpload: hasOAuth,
    oauthDelegateEmail: settings.oauthDelegateEmail ?? null,
    serviceAccountEmail,
    hint: !settings.credentialsBase64
      ? "관리자 > Google Drive에서 서비스 계정 JSON을 등록하세요."
      : !settings.rootFolderId?.trim()
        ? "루트 폴더 ID가 필요합니다. shinkang888@gmail.com Drive의 lawygo 폴더 ID를 설정하세요."
        : !hasOAuth
          ? "파일 업로드를 위해 관리자가 Drive OAuth 업로드 권한을 연결해야 합니다."
          : !available
            ? "OAuth는 연결되었으나 루트 폴더 접근을 확인할 수 없습니다."
            : null,
  });
}
