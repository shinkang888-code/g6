/**
 * 회원가입: 아이디, 비밀번호, 관리번호 저장 → status = pending (관리자 승인 전 대기)
 * Rate limiting 적용 (브루트포스·스팸 방지)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { hashPassword } from "@/lib/authPassword";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { defaultPermissionRoleId, isRelinquishedUserStatus } from "@/lib/userAdmin";
import { purgeRelinquishedAccountForRejoin } from "@/lib/userResign";
import { ensureCompanyGroup } from "@/lib/tenantScope";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, `auth:signup:${getClientIdentifier(request)}`, LIMIT_AUTH_PER_MIN, {
    routePath: "/api/auth/signup",
    source: "auth",
  });
  if (limited) return limited;

  let body: { loginId?: string; password?: string; managementNumber?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const loginId = (body.loginId ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const managementNumber = (body.managementNumber ?? "").trim();
  const name = (body.name ?? "").trim();

  if (!loginId || !password || !managementNumber) {
    return NextResponse.json(
      { error: "아이디, 비밀번호, 관리번호를 모두 입력하세요." },
      { status: 400 }
    );
  }

  if (loginId.length < 2) {
    return NextResponse.json({ error: "아이디는 2자 이상이어야 합니다." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      {
        error: "DB가 연결되지 않았습니다. .env.local(또는 Vercel 환경 변수)에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정하고, Supabase에 site_users 테이블을 생성한 뒤 서버를 재시작하세요.",
        code: "DB_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const { data: existing, error: existingError } = await db
    .from("site_users")
    .select("id, login_id, management_number, status")
    .eq("login_id", loginId)
    .maybeSingle();

  if (existingError) {
    console.error("signup existing check:", existingError);
    const msg =
      process.env.NODE_ENV === "development"
        ? `DB 조회 오류: ${existingError.message}. site_users 테이블이 있는지 Supabase SQL Editor에서 확인하세요.`
        : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
  if (existing) {
    if (isRelinquishedUserStatus(existing.status)) {
      const cleared = await purgeRelinquishedAccountForRejoin(db, existing);
      if (!cleared.ok) {
        return NextResponse.json({ error: cleared.error }, { status: 500 });
      }
      if (!cleared.cleared) {
        return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
      }
    } else {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
  }

  const { count, error: countError } = await db
    .from("site_users")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber);
  if (countError) {
    console.error("signup count:", countError);
    const msg =
      process.env.NODE_ENV === "development"
        ? `DB 조회 오류: ${countError.message}. site_users 테이블을 생성했는지 확인하세요.`
        : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
  const isFirstInTenant = (count ?? 0) === 0;

  const password_hash = hashPassword(password);
  const status = isFirstInTenant ? "active" : "pending";
  const role = isFirstInTenant ? "관리자" : "직원";
  const permissionRoleId = isFirstInTenant ? "company_admin" : defaultPermissionRoleId(role);

  try {
    await ensureCompanyGroup(db, managementNumber);
  } catch (e) {
    console.error("signup ensureCompanyGroup:", e);
  }

  const { data: inserted, error } = await db
    .from("site_users")
    .insert({
      login_id: loginId,
      password_hash,
      management_number: managementNumber,
      status,
      name: name || null,
      role,
      permission_role_id: permissionRoleId,
      is_company_founder: isFirstInTenant,
      profile: { signupSource: "local" },
      approved_at: isFirstInTenant ? new Date().toISOString() : null,
      approved_by: isFirstInTenant ? "tenant-first-user" : null,
    })
    .select("id, login_id, status, created_at")
    .single();

  if (error) {
    console.error("signup insert error:", error);
    const code = error.code ?? "";
    const hint =
      process.env.NODE_ENV === "development"
        ? ` (${code}: ${error.message})`
        : "";
    if (code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "site_users 테이블이 없습니다. Supabase 대시보드 → SQL Editor에서 supabase/migrations/20260307200000_site_users.sql 내용을 실행한 뒤 다시 시도하세요." + hint,
        },
        { status: 503 }
      );
    }
    if (code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
    return NextResponse.json(
      { error: "회원가입 처리에 실패했습니다." + hint },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    pendingApproval: !isFirstInTenant,
    message: isFirstInTenant
      ? "해당 회사의 첫 회원(사내관리자)으로 가입되었습니다. 바로 로그인할 수 있습니다."
      : "가입승인중입니다. 관리자 승인 후 로그인할 수 있습니다.",
    user: { id: inserted.id, loginId: inserted.login_id, status: inserted.status },
  });
}
