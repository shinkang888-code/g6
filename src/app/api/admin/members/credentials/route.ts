/**
 * 직원 로그인 아이디/비밀번호 수정 - 로그인한 사용자면 누구나 가능
 * PATCH body: { loginId (기존), newLoginId?, newPassword? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { hashPassword } from "@/lib/authPassword";

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;
  const { session } = auth;

  let body: { loginId?: string; newLoginId?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const loginId = (body.loginId ?? "").trim().toLowerCase();
  const newLoginId = (body.newLoginId ?? "").trim().toLowerCase() || null;
  const newPassword = body.newPassword ?? "";

  if (!loginId) {
    return NextResponse.json({ error: "대상 로그인 아이디(loginId)를 입력하세요." }, { status: 400 });
  }

  const isAdmin = session.role === "관리자" || session.menuPermissions?.includes("관리자");
  const isSelf = session.loginId.toLowerCase() === loginId;
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "본인 계정만 수정할 수 있습니다." }, { status: 403 });
  }

  if (newLoginId && newLoginId.length < 2) {
    return NextResponse.json({ error: "새 아이디는 2자 이상이어야 합니다." }, { status: 400 });
  }
  if (newPassword && newPassword.length < 4) {
    return NextResponse.json({ error: "새 비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { data: user, error: findError } = await db
    .from("site_users")
    .select("id, login_id")
    .eq("login_id", loginId)
    .single();

  if (findError || !user) {
    return NextResponse.json({ error: "해당 로그인 아이디를 가진 회원을 찾을 수 없습니다." }, { status: 404 });
  }

  if (newLoginId && newLoginId !== loginId) {
    const { data: dup } = await db
      .from("site_users")
      .select("id")
      .eq("login_id", newLoginId)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ error: "이미 사용 중인 새 아이디입니다." }, { status: 409 });
    }
  }

  const updates: { login_id?: string; password_hash?: string } = {};
  if (newLoginId) updates.login_id = newLoginId;
  if (newPassword) updates.password_hash = hashPassword(newPassword);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, message: "변경 사항이 없습니다." });
  }

  const { error: updateError } = await db
    .from("site_users")
    .update(updates)
    .eq("id", user.id);

  if (updateError) {
    console.error("admin members credentials:", updateError);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    loginId: newLoginId ?? loginId,
  });
}
