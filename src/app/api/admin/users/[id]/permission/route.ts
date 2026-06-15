import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { assertUserManageableByAdmin } from "@/lib/companyRegistryAuth";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import {
  actorCanAssignAdminRole,
  actorCanModifyTargetAdminRole,
  ADMIN_ROLE_LABELS,
  COMPANY_ADMIN_ROLE_ID,
  COMPANY_CO_ADMIN_ROLE_ID,
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_DEPUTY_ROLE_ID,
  SYSTEM_ADMIN_ROLE_IDS,
} from "@/lib/adminRoles";
import { countCompanySuperAdmins } from "@/lib/tenantUser";

const ASSIGNABLE = new Set<string>([...SYSTEM_ADMIN_ROLE_IDS]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  const { id } = await params;
  const access = await assertUserManageableByAdmin(db, session, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "사용자를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  let body: { permissionRoleId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const permissionRoleId = (body.permissionRoleId ?? "").trim();
  if (!permissionRoleId) {
    return NextResponse.json({ error: "permissionRoleId가 필요합니다." }, { status: 400 });
  }

  const { data: user } = await db
    .from("site_users")
    .select("login_id, permission_role_id, management_number, is_company_founder, role, status")
    .eq("id", id)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const currentRoleId = String(user.permission_role_id ?? "");
  if (!actorCanModifyTargetAdminRole(session, currentRoleId)) {
    return NextResponse.json(
      { error: "해당 회원의 현재 관리 권한을 변경할 권한이 없습니다." },
      { status: 403 }
    );
  }

  if (ASSIGNABLE.has(permissionRoleId) && !actorCanAssignAdminRole(session, permissionRoleId)) {
    return NextResponse.json({ error: "해당 관리 역할을 부여할 권한이 없습니다." }, { status: 403 });
  }

  const demotingFounder =
    Boolean(user.is_company_founder) &&
    permissionRoleId !== COMPANY_ADMIN_ROLE_ID &&
    permissionRoleId !== "admin";

  if (demotingFounder) {
    const others = await countCompanySuperAdmins(db, String(user.management_number), id);
    if (others === 0) {
      return NextResponse.json(
        { error: "해당 회사의 마지막 사내관리자는 강등할 수 없습니다." },
        { status: 400 }
      );
    }
  }

  const updateRow: Record<string, unknown> = { permission_role_id: permissionRoleId };

  if (permissionRoleId === COMPANY_ADMIN_ROLE_ID || permissionRoleId === "admin") {
    updateRow.role = "관리자";
  } else if (permissionRoleId === COMPANY_CO_ADMIN_ROLE_ID) {
    updateRow.role = "관리자";
  } else if (
    permissionRoleId === PLATFORM_ADMIN_ROLE_ID ||
    permissionRoleId === PLATFORM_DEPUTY_ROLE_ID
  ) {
    updateRow.role = "관리자";
  }

  if (permissionRoleId === COMPANY_ADMIN_ROLE_ID) {
    updateRow.is_company_founder = true;
  }

  const { error } = await db.from("site_users").update(updateRow).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logUserAdminAction(db, {
    targetLoginId: user.login_id,
    actorLoginId: session.loginId,
    action: "permission_change",
    summary: `관리 역할 변경 → ${ADMIN_ROLE_LABELS[permissionRoleId] ?? permissionRoleId}`,
    changes: { from: user.permission_role_id, to: permissionRoleId },
  });

  return NextResponse.json({
    success: true,
    permissionRoleId,
    label: ADMIN_ROLE_LABELS[permissionRoleId] ?? permissionRoleId,
  });
}
