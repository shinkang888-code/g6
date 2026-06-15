/**
 * LawTop 스타일 통합 사용자관리 API
 * GET ?view=active|pending|resigned&role=&q=&scope=all (플랫폼 관리자)
 * POST — 사용자 등록 (active)
 */

import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/authPassword";
import {
  defaultPermissionRoleId,
  isActiveUserStatus,
  isInactiveUserStatus,
  isRelinquishedUserStatus,
  matchesRoleFilter,
  matchesUserSearch,
  type SiteUserRow,
} from "@/lib/userAdmin";
import { purgeRelinquishedAccountForRejoin } from "@/lib/userResign";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import { ensureCompanyGroup } from "@/lib/tenantScope";
import { requireUserManagementAuth } from "@/lib/userManagementAuth";
import { normalizeManagementNumber } from "@/lib/managementNumber";

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;

const SELECT_FIELDS =
  "id, login_id, management_number, status, name, role, department, email, phone, profile, permission_role_id, created_at, approved_at, approved_by, resigned_at, resigned_by, resign_reason, google_email, auth_provider, is_company_founder, organization_id";

export async function GET(request: NextRequest) {
  const auth = await requireUserManagementAuth();
  if ("error" in auth) return auth.error;
  const { session, db, isPlatformStaff } = auth;

  const view = request.nextUrl.searchParams.get("view") ?? "active";
  const roleFilter = request.nextUrl.searchParams.get("role") ?? "all";
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const scopeAll = request.nextUrl.searchParams.get("scope") === "all";
  const mnFilter = request.nextUrl.searchParams.get("managementNumber")?.trim();

  let query = db.from("site_users").select(SELECT_FIELDS).order("created_at", { ascending: false });

  if (scopeAll && isPlatformStaff) {
    if (mnFilter) {
      const mn = normalizeManagementNumber(mnFilter);
      if (mn) query = query.eq("management_number", mn);
    }
  } else {
    const managementNumber = (session.managementNumber ?? "").trim();
    if (!managementNumber) {
      return NextResponse.json({ error: "관리번호(회사)가 설정되지 않았습니다." }, { status: 403 });
    }
    query = query.eq("management_number", managementNumber);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let users = (data ?? []) as SiteUserRow[];

  if (view === "pending") {
    users = users.filter((u) => u.status === "pending");
  } else if (view === "signup-queue") {
    users = users.filter((u) => u.status === "pending" || u.status === "on_hold");
  } else if (view === "resigned") {
    users = users.filter((u) => isInactiveUserStatus(u.status));
  } else {
    users = users.filter((u) => isActiveUserStatus(u.status));
  }

  users = users.filter((u) => matchesRoleFilter(u.role, roleFilter));
  users = users.filter((u) => matchesUserSearch(u, q));

  return NextResponse.json({
    users,
    count: users.length,
    scopeAll: scopeAll && isPlatformStaff,
    isPlatformStaff,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserManagementAuth();
  if ("error" in auth) return auth.error;
  const { session, db, isPlatformSuperAdmin } = auth;

  let body: {
    loginId?: string;
    password?: string;
    name?: string;
    role?: string;
    managementNumber?: string;
    department?: string;
    email?: string;
    phone?: string;
    status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const loginId = (body.loginId ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();
  const role = (body.role ?? "").trim();
  const roleVal = ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]) ? role : "직원";
  const initialStatus = body.status === "pending" ? "pending" : "active";

  let managementNumber = (session.managementNumber ?? "").trim();
  if (body.managementNumber && isPlatformSuperAdmin) {
    const normalized = normalizeManagementNumber(body.managementNumber);
    if (normalized) managementNumber = normalized;
  }
  if (!managementNumber) {
    return NextResponse.json({ error: "관리번호가 필요합니다." }, { status: 400 });
  }

  if (!loginId || loginId.length < 2) {
    return NextResponse.json({ error: "아이디는 2자 이상이어야 합니다." }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  await ensureCompanyGroup(db, managementNumber);

  const { data: existing } = await db
    .from("site_users")
    .select("id, login_id, management_number, status")
    .eq("login_id", loginId)
    .maybeSingle();
  if (existing) {
    if (isRelinquishedUserStatus(existing.status)) {
      const cleared = await purgeRelinquishedAccountForRejoin(db, existing, {
        actorLoginId: session.loginId,
        reason: "관리자 등록을 위한 퇴사·제외 계정 정리",
      });
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

  const permissionRoleId = defaultPermissionRoleId(roleVal);
  const now = new Date().toISOString();
  const insertRow: Record<string, unknown> = {
    login_id: loginId,
    password_hash: hashPassword(password),
    name: name || null,
    role: roleVal,
    status: initialStatus,
    management_number: managementNumber,
    department: body.department?.trim() || null,
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    permission_role_id: permissionRoleId,
    profile: {},
  };
  if (initialStatus === "active") {
    insertRow.approved_at = now;
    insertRow.approved_by = session.loginId;
  }

  const { data: inserted, error } = await db
    .from("site_users")
    .insert(insertRow)
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logUserAdminAction(db, {
    targetLoginId: loginId,
    actorLoginId: session.loginId,
    action: "create",
    summary: `사용자 등록 (${initialStatus})`,
    changes: { role: roleVal, status: initialStatus, management_number: managementNumber },
  });

  return NextResponse.json({ user: inserted });
}
