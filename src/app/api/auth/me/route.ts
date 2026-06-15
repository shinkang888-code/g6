/**
 * 로그인한 회원 본인 정보 조회/수정 (직원 정보와 동일 계정 연동)
 * GET: 본인 프로필 (이름, 직급, 로그인아이디, 관리번호)
 * PATCH: 이름, 직급, 비밀번호, 전체관리자 작업 관리번호 전환
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { hashPassword, verifyPassword } from "@/lib/authPassword";
import { createSessionCookie } from "@/lib/authSession";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN, LIMIT_AUTH_READ_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { isPlatformSuperAdmin } from "@/lib/adminRoles";
import {
  canSwitchTenant,
  listSwitchableTenants,
  resolveActiveManagementNumber,
  resolveHomeManagementNumber,
  validateTenantSwitchTarget,
  withActiveTenant,
} from "@/lib/platformTenantSwitch";

const ROLE_OPTIONS = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:me:${getClientIdentifier(request)}`,
    LIMIT_AUTH_READ_PER_MIN,
    { routePath: "/api/auth/me", source: "auth" }
  );
  if (limited) return limited;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { data: user, error } = await db
    .from("site_users")
    .select("id, login_id, name, role, management_number, status")
    .eq("id", session.userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const platformSuper = isPlatformSuperAdmin(session);
  const homeMn = resolveHomeManagementNumber(session) || (user.management_number as string | null) || "";
  const activeMn = resolveActiveManagementNumber(session) || homeMn;
  const switchableTenants = platformSuper ? await listSwitchableTenants(db, session) : [];

  return NextResponse.json({
    user: {
      id: user.id,
      loginId: user.login_id,
      name: user.name ?? user.login_id,
      role: user.role ?? "",
      managementNumberMasked: platformSuper
        ? activeMn
        : user.management_number
          ? "****" + String(user.management_number).slice(-2)
          : "",
      homeManagementNumber: platformSuper ? homeMn : undefined,
      activeManagementNumber: platformSuper ? activeMn : undefined,
      isPlatformSuperAdmin: platformSuper,
      canSwitchTenant: canSwitchTenant(session),
      switchableTenants,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:me-patch:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/auth/me", source: "auth" }
  );
  if (limited) return limited;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  let body: {
    name?: string;
    role?: string;
    currentPassword?: string;
    newPassword?: string;
    activeManagementNumber?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: existing } = await db
    .from("site_users")
    .select("id, password_hash, name, role")
    .eq("id", session.userId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const updates: { name?: string; role?: string | null; password_hash?: string } = {};
  let nextSession: typeof session = session;

  if (body.activeManagementNumber !== undefined && String(body.activeManagementNumber).trim()) {
    const validated = await validateTenantSwitchTarget(db, session, body.activeManagementNumber);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    nextSession = withActiveTenant(session, validated.managementNumber);
  }

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    updates.name = (name || existing.name) ?? null;
  }

  if (body.role !== undefined) {
    const role = String(body.role ?? "").trim();
    updates.role = ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number]) ? role : (existing.role ?? null);
  }

  if (body.newPassword !== undefined && String(body.newPassword).length > 0) {
    const current = body.currentPassword ?? "";
    const newPw = String(body.newPassword);
    if (!verifyPassword(current, existing.password_hash)) {
      return NextResponse.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 400 });
    }
    if (newPw.length < 4) {
      return NextResponse.json({ error: "새 비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
    }
    updates.password_hash = hashPassword(newPw);
  }

  if (Object.keys(updates).length === 0 && nextSession === session) {
    return NextResponse.json({ success: true, message: "변경 사항이 없습니다." });
  }

  let updatedName = session.name;
  let updatedRole = session.role;

  if (Object.keys(updates).length > 0) {
    const { data: updated, error: updateError } = await db
      .from("site_users")
      .update(updates)
      .eq("id", session.userId)
      .select("name, role")
      .single();

    if (updateError) {
      return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
    }
    updatedName = updated?.name ?? session.name;
    updatedRole = updated?.role ?? session.role;
  }

  const newPayload = {
    ...nextSession,
    name: updatedName,
    role: updatedRole,
  };

  const cookie = createSessionCookie(newPayload);
  const activeMn = resolveActiveManagementNumber(newPayload);
  const res = NextResponse.json({
    success: true,
    user: {
      name: newPayload.name,
      role: newPayload.role,
      activeManagementNumber: isPlatformSuperAdmin(newPayload) ? activeMn : undefined,
      managementNumberMasked: isPlatformSuperAdmin(newPayload)
        ? activeMn
        : newPayload.managementNumber
          ? "****" + String(newPayload.managementNumber).slice(-2)
          : "",
    },
    tenantSwitched: body.activeManagementNumber !== undefined && nextSession !== session,
  });
  res.headers.set("Set-Cookie", cookie);
  return res;
}
