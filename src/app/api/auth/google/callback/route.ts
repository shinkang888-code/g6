/**
 * Google OAuth 콜백 — site_users 연동 및 세션 발급
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { issueAuthSessionCookie } from "@/lib/issueAuthSession";
import { buildLoginTenantSession } from "@/lib/platformTenantSwitch";
import { isLoginAllowedStatus, effectivePermissionRoleId, isRelinquishedUserStatus, RELINQUISHED_ACCOUNT_LOGIN_MESSAGE } from "@/lib/userAdmin";
import { getMenuPermissionsForRole } from "@/lib/rolePermissionsServer";
import { hashPassword } from "@/lib/authPassword";
import crypto from "crypto";
import {
  createGooglePendingCookie,
  exchangeGoogleCode,
  getGoogleRedirectUri,
  loginIdFromGoogleEmail,
  verifyOAuthState,
} from "@/lib/googleAuth";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

function redirectWithError(origin: string, code: string, message: string): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("google_error", code);
  url.searchParams.set("google_message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:google-callback:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/auth/google/callback", source: "auth" }
  );
  if (limited) return limited;

  const origin = request.nextUrl.origin;
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return redirectWithError(origin, "denied", "Google 로그인이 취소되었습니다.");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const mode = verifyOAuthState(state);
  if (!code || !mode) {
    return redirectWithError(origin, "invalid", "Google 인증 정보가 올바르지 않습니다. 다시 시도해 주세요.");
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return redirectWithError(origin, "db", "DB가 연결되지 않았습니다.");
  }

  let profile;
  try {
    profile = await exchangeGoogleCode(code, getGoogleRedirectUri(origin));
  } catch {
    return redirectWithError(origin, "token", "Google 계정 정보를 가져오지 못했습니다.");
  }

  if (!profile?.googleId || !profile.email) {
    return redirectWithError(origin, "profile", "Google 이메일 정보를 확인할 수 없습니다.");
  }

  const loginId = loginIdFromGoogleEmail(profile.email);

  const { data: byGoogle } = await db
    .from("site_users")
    .select("id, login_id, name, role, status, management_number, google_id, permission_role_id, google_email")
    .eq("google_id", profile.googleId)
    .maybeSingle();

  const { data: byEmail } = await db
    .from("site_users")
    .select("id, login_id, name, role, status, management_number, google_id, permission_role_id, google_email")
    .eq("login_id", loginId)
    .maybeSingle();

  let user = byGoogle ?? byEmail;

  if (user && !user.google_id) {
    await db
      .from("site_users")
      .update({
        google_id: profile.googleId,
        google_email: profile.email,
        auth_provider: "google",
        name: user.name || profile.name || null,
      })
      .eq("id", user.id);
    user = { ...user, google_id: profile.googleId };
  }

  if (mode === "signup") {
    if (user && !isRelinquishedUserStatus(user.status)) {
      const url = new URL("/login", origin);
      url.searchParams.set("google_error", "exists");
      url.searchParams.set("google_message", "이미 가입된 Google 계정입니다. Google 로그인을 이용하세요.");
      return NextResponse.redirect(url);
    }

    const res = NextResponse.redirect(new URL("/login/signup/google-complete", origin));
    res.headers.set(
      "Set-Cookie",
      createGooglePendingCookie({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
      })
    );
    return res;
  }

  // login mode
  if (!user) {
    const url = new URL("/login/signup/google-complete", origin);
    url.searchParams.set("from", "login");
    const res = NextResponse.redirect(url);
    res.headers.set(
      "Set-Cookie",
      createGooglePendingCookie({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
      })
    );
    return res;
  }

  if (!isLoginAllowedStatus(user.status)) {
    if (isRelinquishedUserStatus(user.status)) {
      const url = new URL("/login/signup/google-complete", origin);
      url.searchParams.set("from", "rejoin");
      const res = NextResponse.redirect(url);
      res.headers.set(
        "Set-Cookie",
        createGooglePendingCookie({
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
        })
      );
      return res;
    }

    const msg =
      user.status === "pending"
        ? "가입승인중입니다. 관리자 승인 후 Google 로그인할 수 있습니다."
        : user.status === "on_hold"
          ? "가입 승인이 보류되었습니다. 관리자에게 문의하세요."
          : user.status === "rejected"
            ? "가입이 거절된 계정입니다. 관리자에게 문의하세요."
            : RELINQUISHED_ACCOUNT_LOGIN_MESSAGE;
    return redirectWithError(origin, "pending", msg);
  }

  const permissionRoleId = effectivePermissionRoleId(user);
  const menuPermissions = await getMenuPermissionsForRole(permissionRoleId);

  const cookie = issueAuthSessionCookie(
    buildLoginTenantSession({
      userId: user.id,
      loginId: user.login_id,
      name: user.name ?? user.login_id,
      managementNumber: user.management_number ?? undefined,
      role: user.role ?? undefined,
      permissionRoleId,
      menuPermissions,
    }),
    {
      loginId: user.login_id,
      managementNumber: user.management_number ?? undefined,
      googleEmail: profile.email,
    }
  );

  const res = NextResponse.redirect(new URL("/", origin));
  res.headers.set("Set-Cookie", cookie);
  return res;
}
