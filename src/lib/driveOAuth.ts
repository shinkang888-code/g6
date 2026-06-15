/**
 * Google Drive OAuth 위임 (개인 Gmail 업로드용)
 * 서비스 계정은 My Drive에 파일 업로드 불가 → shinkang888 등 사용자 OAuth refresh token 사용
 */

import crypto from "crypto";
import { google } from "googleapis";
import { createGoogleOAuthClient } from "@/lib/googleAuth";

export const DRIVE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
];

const SECRET =
  process.env.GOOGLE_OAUTH_STATE_SECRET ??
  process.env.SESSION_SECRET ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "lawygo-drive-oauth";

export function getDriveOAuthRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/admin/settings/drive/oauth/callback`;
}

export function signDriveOAuthState(loginId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ mode: "drive_oauth", loginId, nonce: crypto.randomBytes(8).toString("hex"), ts: Date.now() }),
    "utf-8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDriveOAuthState(state: string): { loginId: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      mode?: string;
      loginId?: string;
      ts?: number;
    };
    if (parsed.mode !== "drive_oauth" || !parsed.loginId?.trim()) return null;
    if (!parsed.ts || Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return { loginId: parsed.loginId.trim() };
  } catch {
    return null;
  }
}

export async function buildDriveOAuthUrl(origin: string, loginId: string): Promise<string | null> {
  const redirectUri = getDriveOAuthRedirectUri(origin);
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_OAUTH_SCOPES,
    state: signDriveOAuthState(loginId),
    include_granted_scopes: true,
  });
}

export async function exchangeDriveOAuthCode(
  origin: string,
  code: string
): Promise<{ refreshToken: string; email: string } | null> {
  const redirectUri = getDriveOAuthRedirectUri(origin);
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) return null;

  const { tokens } = await client.getToken(code);
  const refreshToken = tokens.refresh_token?.trim();
  if (!refreshToken) return null;

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email?.trim();
  if (!email) return null;

  return { refreshToken, email };
}

export async function createDriveOAuthClient(
  origin: string,
  refreshToken: string
): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const redirectUri = getDriveOAuthRedirectUri(origin);
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) return null;
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export const DEFAULT_DRIVE_DELEGATE_EMAIL = "shinkang888@gmail.com";
