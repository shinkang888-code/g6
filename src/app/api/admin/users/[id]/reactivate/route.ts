import { NextRequest, NextResponse } from "next/server";
import { logUserAdminAction } from "@/lib/userAdminAudit";
import { assertUserInTenant, requireTenantSession } from "@/lib/tenantScope";

const SELECT_FIELDS =
  "id, login_id, management_number, status, name, role, department, email, phone, profile, permission_role_id, created_at, approved_at, approved_by, resigned_at, resigned_by, resign_reason";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  const { id } = await params;
  const inTenant = await assertUserInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "사용자를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const { data: user } = await db.from("site_users").select("login_id").eq("id", id).maybeSingle();
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const { data: updated, error } = await db
    .from("site_users")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: session.loginId,
      resigned_at: null,
      resigned_by: null,
      resign_reason: null,
    })
    .eq("id", id)
    .eq("management_number", managementNumber)
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logUserAdminAction(db, {
    targetLoginId: user.login_id,
    actorLoginId: session.loginId,
    action: "reactivate",
    summary: "복직 처리",
  });

  return NextResponse.json({ user: updated });
}
