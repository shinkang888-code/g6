/**
 * 회원 신청 일괄 삭제 (관리자)
 * body: { ids?: string[], loginIds?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  let body: { ids?: string[]; loginIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const ids = body.ids ?? [];
  const loginIds = (body.loginIds ?? []).map((s: string) => String(s).trim()).filter(Boolean);

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  let targetIds = [...ids];

  if (loginIds.length > 0) {
    const { data: rows } = await db.from("site_users").select("id").in("login_id", loginIds);
    targetIds = [...targetIds, ...(rows ?? []).map((r) => r.id)];
  }

  targetIds = [...new Set(targetIds)];
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "삭제할 회원을 선택하거나 아이디를 입력하세요." }, { status: 400 });
  }

  const { error: deleteError } = await db.from("site_users").delete().in("id", targetIds);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true, count: targetIds.length });
}
