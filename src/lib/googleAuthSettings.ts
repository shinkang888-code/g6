/**
 * Google OAuth 설정 — 환경 변수 우선, app_settings 보조
 */

import { getAppSetting } from "@/lib/appSettingsServer";
import { resolveEnvOrDbValue } from "@/lib/envOverrideSettings";

export const GOOGLE_OAUTH_SETTINGS_KEY = "google_oauth_settings";

export type GoogleOAuthSettings = {
  clientId?: string;
  clientSecret?: string;
  enabled?: boolean;
  preferDbOverEnv?: boolean;
};

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  source: "env" | "db" | "none";
};

export async function getGoogleOAuthCredentials(): Promise<GoogleOAuthCredentials> {
  const fromDb = await getAppSetting<GoogleOAuthSettings>(GOOGLE_OAUTH_SETTINGS_KEY);
  const preferDb = fromDb?.preferDbOverEnv === true;

  const envId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const envSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const dbId = fromDb?.clientId?.trim() ?? "";
  const dbSecret = fromDb?.clientSecret?.trim() ?? "";

  const clientId = resolveEnvOrDbValue(envId, dbId, preferDb) ?? "";
  const clientSecret = resolveEnvOrDbValue(envSecret, dbSecret, preferDb) ?? "";

  if (fromDb?.enabled === false && !preferDb) {
    return { clientId: "", clientSecret: "", source: "none" };
  }

  if (clientId && clientSecret) {
    const fromEnv = Boolean(envId && envSecret);
    const usingDb = preferDb && dbId && dbSecret;
    return {
      clientId,
      clientSecret,
      source: usingDb || (!fromEnv && dbId && dbSecret) ? "db" : fromEnv ? "env" : "db",
    };
  }

  return { clientId: "", clientSecret: "", source: "none" };
}

export async function isGoogleAuthEnabled(): Promise<boolean> {
  const creds = await getGoogleOAuthCredentials();
  return Boolean(creds.clientId && creds.clientSecret);
}
