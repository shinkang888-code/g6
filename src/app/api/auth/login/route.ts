/**
 * 로그인: 아이디 + 비밀번호 + 관리번호 검증, 승인 회원만 로그인 가능
 * Rate limiting 적용 (브루트포스 방지)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { verifyPassword } from "@/lib/authPassword";
import { issueAuthSessionCookie } from "@/lib/issueAuthSession";
import { isLoginAllowedStatus, effectivePermissionRoleId, isRelinquishedUserStatus, RELINQUISHED_ACCOUNT_LOGIN_MESSAGE } from "@/lib/userAdmin";
import { getMenuPermissionsForRole } from "@/lib/rolePermissionsServer";
import { createIdentityHash } from "@/lib/ledger/identityHash";
import { isLedgerEnabled } from "@/lib/ledger/ledgerConfig";
import { assertTenantSubscriptionAccess, canLoginDespiteSubscriptionBlock } from "@/lib/subscription/subscriptionGate";
import { ensureTenantSubscription } from "@/lib/subscription/subscriptionService";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { logSecurityEvent } from "@/lib/security/securityEventCollector";
import { analyzeAuthFailure } from "@/lib/security/threatAnalyzer";
import { buildLoginTenantSession } from "@/lib/platformTenantSwitch";

function logAuthEvent(request: NextRequest, reason: Parameters<typeof analyzeAuthFailure>[0], loginId?: string) {
  const threat = analyzeAuthFailure(reason);
  void logSecurityEvent({
    ipAddress: getClientIdentifier(request),
    userAgent: request.headers.get("user-agent"),
    attackType: threat.attackType,
    severityLevel: threat.severityLevel,
    status: threat.status,
    source: "auth",
    routePath: "/api/auth/login",
    actorLoginId: loginId,
    metadata: { reason },
  });
}

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, `auth:login:${getClientIdentifier(request)}`, LIMIT_AUTH_PER_MIN, {
    routePath: "/api/auth/login",
    source: "auth",
  });
  if (rateLimited) return rateLimited;

  let body: { loginId?: string; password?: string; managementNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const loginId = (body.loginId ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const managementNumber = (body.managementNumber ?? "").trim();

  if (!loginId || !password || !managementNumber) {
    return NextResponse.json(
      { error: "아이디, 비밀번호, 관리번호를 모두 입력하세요." },
      { status: 400 }
    );
  }

  const db = getSupabaseAdmin();
  if (!db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const missing: string[] = [];
    if (!url?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    const hint = missing.length
      ? `.env.local(로컬) 또는 Vercel 환경 변수(배포)에 ${missing.join(", ")}를 설정한 뒤 서버를 재시작/재배포하세요.`
      : "서버를 재시작한 뒤 다시 시도하세요.";
    return NextResponse.json(
      {
        error: "DB가 연결되지 않았습니다.",
        code: "DB_NOT_CONFIGURED",
        missing,
        hint,
      },
      { status: 503 }
    );
  }

  const { data: user, error } = await db
    .from("site_users")
    .select("id, login_id, password_hash, management_number, status, name, role, permission_role_id")
    .eq("login_id", loginId)
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth/login] DB error:", error.message);
    }
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (!user) {
    logAuthEvent(request, "invalid_credentials", loginId);
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (user.management_number !== managementNumber) {
    logAuthEvent(request, "invalid_credentials", loginId);
    return NextResponse.json({ error: "관리번호가 일치하지 않습니다." }, { status: 401 });
  }

  if (!verifyPassword(password, user.password_hash)) {
    logAuthEvent(request, "invalid_credentials", loginId);
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (!isLoginAllowedStatus(user.status)) {
    const msg =
      user.status === "pending"
        ? "가입승인중입니다. 관리자 승인 후 로그인할 수 있습니다."
        : user.status === "on_hold"
          ? "가입 승인이 보류되었습니다. 관리자에게 문의하세요."
          : user.status === "subscription_hold"
            ? "구독이 정지되어 이용이 제한되었습니다. 사내관리자에게 문의하세요."
          : user.status === "rejected"
            ? "가입이 거절된 계정입니다. 관리자에게 문의하세요."
            : isRelinquishedUserStatus(user.status)
              ? RELINQUISHED_ACCOUNT_LOGIN_MESSAGE
              : "로그인할 수 없는 계정 상태입니다. 관리자에게 문의하세요.";
    logAuthEvent(request, "unapproved", loginId);
    return NextResponse.json(
      {
        error: msg,
        code: isRelinquishedUserStatus(user.status) ? "ACCOUNT_RELINQUISHED" : "LOGIN_NOT_ALLOWED",
        canRejoin: isRelinquishedUserStatus(user.status),
      },
      { status: 403 }
    );
  }

  await ensureTenantSubscription(db, managementNumber);
  const subAccess = await assertTenantSubscriptionAccess(
    db,
    {
      userId: user.id,
      loginId: user.login_id,
      name: user.name ?? user.login_id,
      managementNumber,
      role: user.role ?? undefined,
      permissionRoleId: effectivePermissionRoleId(user),
    },
    managementNumber,
    "/api/auth/login"
  );

  if (!subAccess.allowed) {
    const canAdminLogin = canLoginDespiteSubscriptionBlock({
      permissionRoleId: effectivePermissionRoleId(user),
      role: user.role,
    });
    if (!canAdminLogin) {
      logAuthEvent(request, "unapproved", loginId);
      return NextResponse.json(
        {
          error: subAccess.reason ?? "구독이 만료되어 로그인할 수 없습니다.",
          code: subAccess.code ?? "SUBSCRIPTION_REQUIRED",
          billingRequired: true,
        },
        { status: 403 }
      );
    }
  }

  const permissionRoleId = effectivePermissionRoleId(user);
  const menuPermissions = await getMenuPermissionsForRole(permissionRoleId);

  let hVId: string | undefined;
  if (isLedgerEnabled()) {
    const identity = await createIdentityHash(db, {
      tenantId: user.management_number,
      userId: user.id,
      sessionRef: user.login_id,
    });
    hVId = identity?.id;
  }

  const cookie = issueAuthSessionCookie(
    buildLoginTenantSession({
      userId: user.id,
      loginId: user.login_id,
      name: user.name ?? user.login_id,
      managementNumber: user.management_number,
      role: user.role ?? undefined,
      permissionRoleId,
      menuPermissions,
      hVId,
    }),
    {
      loginId: user.login_id,
      managementNumber: user.management_number,
    }
  );

  const res = NextResponse.json({
    success: true,
    user: { id: user.id, loginId: user.login_id, name: user.name, role: user.role },
  });
  res.headers.set("Set-Cookie", cookie);
  return res;
}
