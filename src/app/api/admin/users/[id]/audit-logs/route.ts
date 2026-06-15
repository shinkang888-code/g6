import { NextRequest, NextResponse } from "next/server";
import { assertUserInTenant, requireTenantSession } from "@/lib/tenantScope";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const { id } = await params;
  const inTenant = await assertUserInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "사용자를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const { data: user } = await db.from("site_users").select("login_id").eq("id", id).maybeSingle();
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await db
    .from("user_admin_audit_logs")
    .select("id, action, summary, actor_login_id, changes, created_at")
    .eq("target_login_id", user.login_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
