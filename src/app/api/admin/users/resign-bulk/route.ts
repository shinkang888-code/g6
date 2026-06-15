import { NextRequest, NextResponse } from "next/server";
import type { ResignType } from "@/lib/userAdmin";
import { deleteUserAccountForResign } from "@/lib/userResign";
import { assertUserEditableByActor, requireUserManagementAuth } from "@/lib/userManagementAuth";

export async function POST(request: NextRequest) {
  const auth = await requireUserManagementAuth();
  if ("error" in auth) return auth.error;
  const { session, db } = auth;

  let body: { ids?: string[]; type?: ResignType; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const ids = [...new Set(body.ids ?? [])];
  if (ids.length === 0) {
    return NextResponse.json({ error: "대상 사용자를 선택하세요." }, { status: 400 });
  }

  const resignType: ResignType = body.type === "excluded" ? "excluded" : "resigned";
  const reason = (body.reason ?? "").trim() || null;

  let processed = 0;
  const errors: string[] = [];

  for (const id of ids) {
    const access = await assertUserEditableByActor(db, session, id);
    if (!access.allowed) {
      errors.push(`${id}: 권한 없음`);
      continue;
    }

    const { data: user } = await db
      .from("site_users")
      .select("id, login_id, management_number, status")
      .eq("id", id)
      .maybeSingle();

    if (!user) {
      errors.push(`${id}: 없음`);
      continue;
    }

    const result = await deleteUserAccountForResign(db, user, {
      actorLoginId: session.loginId,
      type: resignType,
      reason,
    });

    if (!result.ok) {
      errors.push(`${user.login_id}: ${result.error}`);
      continue;
    }

    processed++;
  }

  if (processed === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "처리할 사용자를 찾을 수 없습니다.", errors },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    count: processed,
    deleted: true,
    message: "퇴사 처리 후 계정이 삭제되었습니다. 해당 회원은 새 관리번호로 재가입할 수 있습니다.",
    errors: errors.length ? errors : undefined,
  });
}
