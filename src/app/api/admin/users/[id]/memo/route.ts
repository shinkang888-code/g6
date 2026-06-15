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

  const { data } = await db
    .from("user_memos")
    .select("content, updated_at, updated_by")
    .eq("login_id", user.login_id)
    .maybeSingle();
  return NextResponse.json({
    content: data?.content ?? "",
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  const { id } = await params;
  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const inTenant = await assertUserInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "사용자를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const { data: user } = await db.from("site_users").select("login_id").eq("id", id).maybeSingle();
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const content = String(body.content ?? "");
  const now = new Date().toISOString();

  const { error } = await db.from("user_memos").upsert(
    {
      login_id: user.login_id,
      content,
      updated_at: now,
      updated_by: session.loginId,
    },
    { onConflict: "login_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, updatedAt: now });
}
