/**
 * Google Drive 연동 설정 (환경 변수 + app_settings)
 */

import { getAppSetting } from "./appSettingsServer";
import { resolveEnvOrDbValue } from "./envOverrideSettings";

export type DriveSettings = {
  credentialsBase64?: string;
  rootFolderId?: string;
  enabled?: boolean;
  /** UI에서 env 키를 교체한 경우 DB 값 우선 */
  preferDbOverEnv?: boolean;
  /** 개인 Gmail Drive 업로드용 OAuth refresh token */
  oauthRefreshToken?: string;
  oauthDelegateEmail?: string;
};

const SETTINGS_KEY = "drive_settings";

export async function getDriveSettings(): Promise<DriveSettings> {
  const fromDb = await getAppSetting<DriveSettings>(SETTINGS_KEY);
  const preferDb = fromDb?.preferDbOverEnv === true;

  return {
    credentialsBase64: resolveEnvOrDbValue(
      process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64,
      fromDb?.credentialsBase64,
      preferDb
    ),
    rootFolderId: resolveEnvOrDbValue(
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
      fromDb?.rootFolderId,
      preferDb
    ),
    enabled: fromDb?.enabled !== false,
    preferDbOverEnv: preferDb,
    oauthRefreshToken: fromDb?.oauthRefreshToken?.trim() || undefined,
    oauthDelegateEmail: fromDb?.oauthDelegateEmail?.trim() || undefined,
  };
}

export { SETTINGS_KEY as DRIVE_SETTINGS_KEY };
