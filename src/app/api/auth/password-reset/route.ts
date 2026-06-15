/**
 * 비밀번호 재설정: 아이디 + 관리번호로 본인 확인 후 새 비밀번호로 변경
 * Rate limiting 적용 (브루트포스 방지)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { hashPassword } from "@/lib/authPassword";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:password-reset:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/auth/password-reset", source: "auth" }
  );
  if (limited) return limited;

  let body: { loginId?: string; managementNumber?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const loginId = (body.loginId ?? "").trim();
  const managementNumber = (body.managementNumber ?? "").trim();
  const newPassword = (body.newPassword ?? "").trim();

  if (!loginId || !managementNumber || !newPassword) {
    return NextResponse.json(
      { error: "아이디, 관리번호, 새 비밀번호를 모두 입력하세요." },
      { status: 400 }
    );
  }

  if (newPassword.length < 4) {
    return NextResponse.json({ error: "새 비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      {
        error: "DB가 연결되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정하세요.",
        code: "DB_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const { data: user, error: fetchError } = await db
    .from("site_users")
    .select("id, management_number")
    .eq("login_id", loginId)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: "아이디와 관리번호가 일치하는 회원이 없습니다." }, { status: 404 });
  }

  if (user.management_number !== managementNumber) {
    return NextResponse.json({ error: "관리번호가 일치하지 않습니다." }, { status: 401 });
  }

  const password_hash = hashPassword(newPassword);
  const { error: updateError } = await db
    .from("site_users")
    .update({ password_hash })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다." });
}
