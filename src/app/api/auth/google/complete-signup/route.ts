/**
 * Google 가입 마무리 — 관리번호 입력 후 site_users 생성 (pending → 관리자 승인)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { hashPassword } from "@/lib/authPassword";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN, LIMIT_AUTH_READ_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { defaultPermissionRoleId, isRelinquishedUserStatus, RELINQUISHED_ACCOUNT_SIGNUP_HINT } from "@/lib/userAdmin";
import { purgeRelinquishedAccountForRejoin } from "@/lib/userResign";
import { ensureCompanyGroup } from "@/lib/tenantScope";
import { companyFounderFields } from "@/lib/tenantUser";
import crypto from "crypto";
import {
  clearGooglePendingCookie,
  loginIdFromGoogleEmail,
  parseGooglePendingCookie,
} from "@/lib/googleAuth";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:google-signup:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/auth/google/complete-signup", source: "auth" }
  );
  if (limited) return limited;

  const pending = parseGooglePendingCookie(request.headers.get("cookie"));
  if (!pending) {
    return NextResponse.json(
      { error: "Google 가입 세션이 만료되었습니다. 다시 구글 가입을 시도해 주세요." },
      { status: 400 }
    );
  }

  let body: { managementNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const managementNumber = (body.managementNumber ?? "").trim();
  if (!managementNumber) {
    return NextResponse.json({ error: "관리번호를 입력하세요." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }

  const loginId = loginIdFromGoogleEmail(pending.email);
  let clearedRelinquished = false;

  const { data: existingGoogle } = await db
    .from("site_users")
    .select("id, login_id, management_number, status, google_id")
    .eq("google_id", pending.googleId)
    .maybeSingle();
  if (existingGoogle) {
    if (isRelinquishedUserStatus(existingGoogle.status)) {
      const cleared = await purgeRelinquishedAccountForRejoin(db, existingGoogle);
      if (!cleared.ok) {
        return NextResponse.json({ error: cleared.error }, { status: 500 });
      }
      clearedRelinquished = cleared.cleared;
    } else if (existingGoogle.status === "pending" || existingGoogle.status === "on_hold") {
      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: "가입승인중입니다. 관리자 승인 후 로그인할 수 있습니다.",
        user: { id: existingGoogle.id, loginId, status: existingGoogle.status },
      });
    } else {
      return NextResponse.json({ error: "이미 가입된 Google 계정입니다." }, { status: 409 });
    }
  }

  const { data: existingLogin } = await db
    .from("site_users")
    .select("id, status, google_id, login_id, management_number")
    .eq("login_id", loginId)
    .maybeSingle();
  if (existingLogin) {
    if (isRelinquishedUserStatus(existingLogin.status)) {
      const cleared = await purgeRelinquishedAccountForRejoin(db, existingLogin);
      if (!cleared.ok) {
        return NextResponse.json({ error: cleared.error }, { status: 500 });
      }
      clearedRelinquished = cleared.cleared || clearedRelinquished;
    } else if (!existingLogin.google_id) {
      return NextResponse.json(
        { error: "동일 이메일 아이디가 이미 있습니다. 관리자에게 Google 계정 연동을 요청하세요." },
        { status: 409 }
      );
    } else if (existingLogin.status === "pending" || existingLogin.status === "on_hold") {
      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: "가입승인중입니다. 관리자 승인 후 로그인할 수 있습니다.",
        user: { id: existingLogin.id, loginId, status: existingLogin.status },
      });
    } else {
      return NextResponse.json({ error: "이미 가입된 계정입니다." }, { status: 409 });
    }
  }

  const { count } = await db
    .from("site_users")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber);
  const isFirstInTenant = (count ?? 0) === 0;
  const randomPassword = crypto.randomBytes(24).toString("hex");
  const now = new Date().toISOString();
  const status = isFirstInTenant ? "active" : "pending";
  const founder = isFirstInTenant ? companyFounderFields(now) : null;

  try {
    await ensureCompanyGroup(db, managementNumber);
  } catch (e) {
    console.error("google signup ensureCompanyGroup:", e);
  }

  const insertRow: Record<string, unknown> = {
    login_id: loginId,
    password_hash: hashPassword(randomPassword),
    management_number: managementNumber,
    status,
    name: pending.name || null,
    email: pending.email,
    google_id: pending.googleId,
    google_email: pending.email,
    auth_provider: "google",
    role: founder?.role ?? "직원",
    permission_role_id: founder?.permission_role_id ?? defaultPermissionRoleId("직원"),
    is_company_founder: Boolean(founder?.is_company_founder),
    profile: { signupSource: "google" },
    approved_at: founder?.approved_at ?? null,
    approved_by: founder?.approved_by ?? null,
  };

  const { data: inserted, error } = await db
    .from("site_users")
    .insert(insertRow)
    .select("id, login_id, status, management_number")
    .single();

  if (error) {
    console.error("google complete-signup insert:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 가입된 계정입니다." }, { status: 409 });
    }
    const hint =
      process.env.NODE_ENV === "development" ? ` (${error.code}: ${error.message})` : "";
    return NextResponse.json({ error: `회원가입 처리에 실패했습니다.${hint}` }, { status: 500 });
  }

  const res = NextResponse.json({
    success: true,
    pendingApproval: !isFirstInTenant,
    clearedRelinquished,
    message: isFirstInTenant
      ? clearedRelinquished
        ? `${RELINQUISHED_ACCOUNT_SIGNUP_HINT} 해당 회사의 첫 회원(사내관리자)으로 Google 가입되었습니다. 바로 로그인할 수 있습니다.`
        : "해당 회사의 첫 회원(사내관리자)으로 Google 가입되었습니다. 바로 로그인할 수 있습니다."
      : clearedRelinquished
        ? `${RELINQUISHED_ACCOUNT_SIGNUP_HINT} 가입승인중입니다. 관리자 승인 후 로그인할 수 있습니다.`
        : "가입승인중입니다. 관리자 승인 후 로그인할 수 있습니다.",
    user: {
      id: inserted.id,
      loginId: inserted.login_id,
      status: inserted.status,
      managementNumber: inserted.management_number,
    },
  });
  res.headers.set("Set-Cookie", clearGooglePendingCookie());
  return res;
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:google-signup-pending:${getClientIdentifier(request)}`,
    LIMIT_AUTH_READ_PER_MIN,
    { routePath: "/api/auth/google/complete-signup", source: "auth" }
  );
  if (limited) return limited;

  const pending = parseGooglePendingCookie(request.headers.get("cookie"));
  if (!pending) {
    return NextResponse.json({ pending: false });
  }
  return NextResponse.json({
    pending: true,
    email: pending.email,
    name: pending.name,
  });
}
