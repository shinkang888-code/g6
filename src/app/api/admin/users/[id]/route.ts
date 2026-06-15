/**
 * PATCH /api/admin/users/:id — 사용자 정보 수정
 * 전체관리자: 모든 회원의 관리번호·이름·배치(조직)·역할 수정 가능
 */

import { NextRequest, NextResponse } from "next/server";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import { ensureCompanyGroup } from "@/lib/tenantScope";
import { assertUserEditableByActor, requireUserManagementAuth } from "@/lib/userManagementAuth";
import { normalizeManagementNumber } from "@/lib/managementNumber";
import { listOrganizationsFlat } from "@/lib/companyOrganization";

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;

const SELECT_FIELDS =
  "id, login_id, management_number, status, name, role, department, email, phone, profile, permission_role_id, created_at, approved_at, approved_by, resigned_at, resigned_by, resign_reason, organization_id, is_company_founder";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserManagementAuth();
  if ("error" in auth) return auth.error;
  const { session, db, isPlatformSuperAdmin } = auth;

  const { id } = await params;
  const access = await assertUserEditableByActor(db, session, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "사용자를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: existing, error: findErr } = await db
    .from("site_users")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (findErr || !existing) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  let targetMn = String(existing.management_number ?? access.managementNumber).trim();

  if (typeof body.loginId === "string") patch.login_id = body.loginId.trim().toLowerCase();
  if (typeof body.name === "string" || body.name === null) patch.name = body.name;

  if (typeof body.managementNumber === "string") {
    const newMn = normalizeManagementNumber(body.managementNumber);
    if (!newMn) {
      return NextResponse.json({ error: "유효하지 않은 관리번호입니다." }, { status: 400 });
    }
    if (newMn !== String(existing.management_number ?? "").trim()) {
      if (!isPlatformSuperAdmin) {
        return NextResponse.json({ error: "관리번호 변경은 전체관리자만 가능합니다." }, { status: 403 });
      }
      await ensureCompanyGroup(db, newMn);
      patch.management_number = newMn;
      patch.organization_id = null;
      targetMn = newMn;
    }
  }

  if (typeof body.role === "string") {
    const r = body.role.trim();
    patch.role = ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number]) ? r : existing.role;
  }

  if (typeof body.department === "string" || body.department === null) patch.department = body.department;
  if (typeof body.email === "string" || body.email === null) patch.email = body.email;
  if (typeof body.phone === "string" || body.phone === null) patch.phone = body.phone;

  if (body.organizationId !== undefined) {
    const orgId = body.organizationId === null || body.organizationId === "" ? null : String(body.organizationId);
    if (orgId) {
      const orgs = await listOrganizationsFlat(db, targetMn);
      if (!orgs.some((o) => o.id === orgId)) {
        return NextResponse.json({ error: "해당 관리번호의 조직을 찾을 수 없습니다." }, { status: 400 });
      }
      patch.organization_id = orgId;
      const org = orgs.find((o) => o.id === orgId);
      if (org && body.department === undefined) {
        patch.department = org.name;
      }
    } else {
      patch.organization_id = null;
    }
  }

  if (body.profile && typeof body.profile === "object") {
    patch.profile = { ...(existing.profile as object), ...(body.profile as object) };
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const { data: updated, error } = await db
    .from("site_users")
    .update(patch)
    .eq("id", id)
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logUserAdminAction(db, {
    targetLoginId: existing.login_id,
    actorLoginId: session.loginId,
    action: "update",
    summary: "사용자 정보 수정",
    changes: patch,
  });

  return NextResponse.json({ user: updated });
}
