import { NextRequest, NextResponse } from "next/server";
import type { ResignType } from "@/lib/userAdmin";
import { deleteUserAccountForResign } from "@/lib/userResign";
import { assertUserEditableByActor, requireUserManagementAuth } from "@/lib/userManagementAuth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserManagementAuth();
  if ("error" in auth) return auth.error;
  const { session, db } = auth;

  const { id } = await params;
  let body: { type?: ResignType; reason?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const resignType: ResignType = body.type === "excluded" ? "excluded" : "resigned";
  const reason = (body.reason ?? "").trim() || null;

  const access = await assertUserEditableByActor(db, session, id);
  if (!access.allowed) {
    return NextResponse.json({ error: "사용자를 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const { data: user } = await db
    .from("site_users")
    .select("id, login_id, management_number, status")
    .eq("id", id)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const result = await deleteUserAccountForResign(db, user, {
    actorLoginId: session.loginId,
    type: resignType,
    reason,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deleted: true,
    loginId: user.login_id,
    message: "퇴사 처리 후 계정이 삭제되었습니다. 해당 회원은 새 관리번호로 재가입할 수 있습니다.",
  });
}
