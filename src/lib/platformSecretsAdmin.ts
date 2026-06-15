/**
 * 플랫폼 비밀키·환경변수 설정 — 전체관리자(shinkang) / 전체부관리자(kangjunchul8@gmail.com) 전용
 */

import type { SessionPayload } from "@/lib/authSession";

/** 기본 허용 loginId (소문자 비교) */
export const DEFAULT_PLATFORM_SECRETS_ADMIN_LOGIN_IDS = [
  "shinkang",
  "kangjunchul8@gmail.com",
] as const;

/** app_settings 키 — 사내관리자에게 노출·변경 금지 */
export const PLATFORM_SECRETS_SETTING_KEYS = [
  "drive_settings",
  "google_oauth_settings",
  "law_open_api_settings",
  "ai_settings",
  "integration_settings",
  "messenger_settings",
] as const;

/** 관리자 UI 경로 — PlatformSecretsGate 적용 */
export const PLATFORM_SECRETS_ADMIN_PATHS = [
  "/admin/settings/drive",
  "/admin/settings/google-oauth",
  "/admin/settings/law-open-api",
  "/admin/settings/integration",
  "/admin/settings/ai",
  "/admin/settings/messenger",
  "/admin/security",
] as const;

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase();
}

function configuredSecretsAdminLoginIds(): string[] {
  const fromEnv = (process.env.PLATFORM_SECRETS_ADMIN_LOGIN_IDS ?? "")
    .split(",")
    .map((s) => normalizeLoginId(s))
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return DEFAULT_PLATFORM_SECRETS_ADMIN_LOGIN_IDS.map(normalizeLoginId);
}

/** 비밀키·환경변수형 관리자 설정 변경 권한 */
export function isPlatformSecretsAdmin(session: SessionPayload): boolean {
  const loginId = normalizeLoginId(session.loginId ?? "");
  if (!loginId) return false;
  return configuredSecretsAdminLoginIds().includes(loginId);
}

export function isSensitiveSettingsKey(key: string): boolean {
  return (PLATFORM_SECRETS_SETTING_KEYS as readonly string[]).includes(key);
}

export function filterSettingsForSession<T extends Record<string, unknown>>(
  settings: T,
  session: SessionPayload
): T {
  if (isPlatformSecretsAdmin(session)) return settings;
  const out = { ...settings };
  for (const key of PLATFORM_SECRETS_SETTING_KEYS) {
    delete out[key];
  }
  return out;
}
