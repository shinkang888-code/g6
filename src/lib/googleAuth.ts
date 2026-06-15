/**
 * Google OAuth 연동 (회원가입·로그인)
 */

import crypto from "crypto";
import { google } from "googleapis";
import { getGoogleOAuthCredentials } from "@/lib/googleAuthSettings";

export type GoogleAuthMode = "login" | "signup";

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
};

export type GooglePendingSignup = {
  googleId: string;
  email: string;
  name: string;
};

const PENDING_COOKIE = "lawygo_google_pending";
const PENDING_MAX_AGE = 60 * 10;
const SECRET =
  process.env.GOOGLE_OAUTH_STATE_SECRET ??
  process.env.SESSION_SECRET ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "lawygo-google-oauth";

/** @deprecated 동기 호출 금지 — isGoogleAuthEnabled() 사용 */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
}

export { isGoogleAuthEnabled as isGoogleAuthConfiguredAsync } from "@/lib/googleAuthSettings";

export function getGoogleRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function getGoogleOAuthLocale(): string {
  return process.env.GOOGLE_OAUTH_LOCALE?.trim() || "ko";
}

export async function createGoogleOAuthClient(redirectUri: string) {
  const { clientId, clientSecret } = await getGoogleOAuthCredentials();
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function signOAuthState(mode: GoogleAuthMode): string {
  const payload = Buffer.from(
    JSON.stringify({ mode, nonce: crypto.randomBytes(8).toString("hex"), ts: Date.now() }),
    "utf-8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string): GoogleAuthMode | null {
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
      mode?: GoogleAuthMode;
      ts?: number;
    };
    if (!parsed.mode || (parsed.mode !== "login" && parsed.mode !== "signup")) return null;
    if (!parsed.ts || Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return parsed.mode;
  } catch {
    return null;
  }
}

export async function buildGoogleAuthUrl(redirectUri: string, mode: GoogleAuthMode): Promise<string | null> {
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) return null;
  const rawUrl = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state: signOAuthState(mode),
    prompt: "select_account",
    include_granted_scopes: true,
  });
  const url = new URL(rawUrl);
  url.searchParams.set("hl", getGoogleOAuthLocale());
  return url.toString();
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleProfile | null> {
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) return null;
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.id || !data.email) return null;
  return {
    googleId: String(data.id),
    email: data.email.toLowerCase(),
    name: (data.name ?? data.given_name ?? data.email.split("@")[0] ?? "").trim(),
    picture: data.picture ?? undefined,
    emailVerified: Boolean(data.verified_email),
  };
}

function encodePending(data: GooglePendingSignup): string {
  const encoded = Buffer.from(JSON.stringify(data), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function decodePending(token: string): GooglePendingSignup | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as GooglePendingSignup;
    if (!parsed.googleId || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createGooglePendingCookie(data: GooglePendingSignup): string {
  const token = encodePending(data);
  const secure = process.env.NODE_ENV === "production" ? "Secure;" : "";
  return `${PENDING_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PENDING_MAX_AGE}; ${secure}`;
}

export function parseGooglePendingCookie(cookieHeader: string | null): GooglePendingSignup | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${PENDING_COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;
  return decodePending(match[1]);
}

export function clearGooglePendingCookie(): string {
  return `${PENDING_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;`;
}

export function loginIdFromGoogleEmail(email: string): string {
  return email.toLowerCase().trim();
}
