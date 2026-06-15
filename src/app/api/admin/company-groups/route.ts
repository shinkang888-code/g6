/**
 * 회사 그룹(관리번호) — LawTop 스타일 테넌트 메타
 * GET ?signupQueue=1 — 가입 승인 대기 목록 포함
 * PATCH: 그룹명·메모·관리번호(5자리) 변경
 * DELETE: 회사 그룹 메타 삭제 (데이터는 유지)
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSessionCookie } from "@/lib/authSession";
import { isActiveUserStatus, type SiteUserRow } from "@/lib/userAdmin";
import {
  deleteCompanyGroupRecord,
  migrateTenantManagementNumber,
  normalizeManagementNumber,
} from "@/lib/managementNumber";
import {
  ensureCompanyGroup,
  requireTenantSession,
  type CompanyGroupSummary,
} from "@/lib/tenantScope";

const SIGNUP_QUEUE_STATUSES = ["pending", "on_hold", "rejected"] as const;
const USER_SELECT =
  "id, login_id, management_number, status, name, role, department, email, phone, profile, permission_role_id, created_at, approved_at, approved_by, resigned_at, resigned_by, resign_reason, google_email, auth_provider";

function isTenantAdmin(role?: string | null, permissionRoleId?: string | null): boolean {
  return role === "관리자" || permissionRoleId === "admin";
}

async function loadSignupQueue(db: SupabaseClient, managementNumber: string) {
  const { data } = await db
    .from("site_users")
    .select(USER_SELECT)
    .eq("management_number", managementNumber)
    .in("status", [...SIGNUP_QUEUE_STATUSES])
    .order("created_at", { ascending: false });
  return (data ?? []) as SiteUserRow[];
}

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  await ensureCompanyGroup(db, managementNumber);

  const includeQueue = request.nextUrl.searchParams.get("signupQueue") === "1";

  const { data: group, error: groupErr } = await db
    .from("company_groups")
    .select("management_number, group_name, memo, created_at, updated_at")
    .eq("management_number", managementNumber)
    .maybeSingle();

  if (groupErr) {
    return NextResponse.json({ error: groupErr.message }, { status: 500 });
  }

  const { data: members } = await db
    .from("site_users")
    .select("id, status")
    .eq("management_number", managementNumber);

  const memberCount = members?.length ?? 0;
  const activeMemberCount =
    members?.filter((m) => isActiveUserStatus(String(m.status ?? ""))).length ?? 0;

  const { count: caseCount } = await db
    .from("cases")
    .select("*", { count: "exact", head: true })
    .eq("management_number", managementNumber);

  const { count: clientCount } = await db
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("management_number", managementNumber)
    .is("deleted_at", null);

  const summary: CompanyGroupSummary = {
    managementNumber,
    groupName: String(group?.group_name ?? `법무법인 ${managementNumber}`),
    memberCount,
    activeMemberCount,
    caseCount: caseCount ?? 0,
    clientCount: clientCount ?? 0,
  };

  const payload: Record<string, unknown> = {
    group: {
      managementNumber,
      groupName: summary.groupName,
      memo: group?.memo ?? "",
      createdAt: group?.created_at ?? null,
      updatedAt: group?.updated_at ?? null,
      hasRecord: Boolean(group),
    },
    summary,
  };

  if (includeQueue) {
    payload.signupQueue = await loadSignupQueue(db, managementNumber);
  }

  return NextResponse.json(payload);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  let body: { groupName?: string; memo?: string; managementNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const groupName = body.groupName !== undefined ? String(body.groupName ?? "").trim() : undefined;
  const memo = body.memo !== undefined ? String(body.memo ?? "").trim() : undefined;
  const newMnRaw = body.managementNumber !== undefined ? String(body.managementNumber ?? "").trim() : undefined;

  let effectiveMn = managementNumber;

  if (newMnRaw !== undefined) {
    if (!isTenantAdmin(session.role, session.permissionRoleId)) {
      return NextResponse.json({ error: "관리번호 변경은 관리자만 가능합니다." }, { status: 403 });
    }
    const normalized = normalizeManagementNumber(newMnRaw);
    if (!normalized) {
      return NextResponse.json({ error: "관리번호는 5자리 숫자로 입력하세요." }, { status: 400 });
    }
    if (normalized !== managementNumber) {
      const migrated = await migrateTenantManagementNumber(db, managementNumber, normalized);
      if (!migrated.ok) {
        return NextResponse.json({ error: migrated.error }, { status: 400 });
      }
      effectiveMn = normalized;
      await db.from("site_users").update({ management_number: normalized }).eq("id", session.userId);
    }
  }

  if (!groupName && memo === undefined && newMnRaw === undefined) {
    return NextResponse.json({ error: "변경할 항목을 입력하세요." }, { status: 400 });
  }

  await ensureCompanyGroup(db, effectiveMn, groupName || undefined);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (groupName) patch.group_name = groupName;
  if (memo !== undefined) patch.memo = memo || null;

  const { data, error } = await db
    .from("company_groups")
    .update(patch)
    .eq("management_number", effectiveMn)
    .select("management_number, group_name, memo, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({
    group: {
      managementNumber: data.management_number,
      groupName: data.group_name,
      memo: data.memo ?? "",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      hasRecord: true,
    },
    managementNumberChanged: effectiveMn !== managementNumber,
    managementNumber: effectiveMn,
  });

  if (effectiveMn !== managementNumber) {
    res.headers.set(
      "Set-Cookie",
      createSessionCookie({
        ...session,
        managementNumber: effectiveMn,
      })
    );
  }

  return res;
}

export async function DELETE() {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  if (!isTenantAdmin(session.role, session.permissionRoleId)) {
    return NextResponse.json({ error: "관리번호 삭제는 관리자만 가능합니다." }, { status: 403 });
  }

  const { count: activeMembers } = await db
    .from("site_users")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber)
    .in("status", ["active", "approved"]);

  if ((activeMembers ?? 0) > 1) {
    return NextResponse.json(
      { error: "다른 재직 구성원이 있어 회사 그룹 메타만 삭제할 수 없습니다. 관리번호 변경을 이용하세요." },
      { status: 400 }
    );
  }

  const deleted = await deleteCompanyGroupRecord(db, managementNumber);
  if (!deleted.ok) return NextResponse.json({ error: deleted.error }, { status: 500 });

  return NextResponse.json({ success: true });
}
