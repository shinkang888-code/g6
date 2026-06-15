/**
 * 직원 계정 생성 (site_users에 승인 상태로 등록, 직원 DB 연동)
 * body: { loginId, password, name?, role?, managementNumber? }
 * 회원 DB(site_users) + 직원 DB(staff) 둘 다 반영하여 연동 유지.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { hashPassword } from "@/lib/authPassword";

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  let body: { loginId?: string; password?: string; name?: string; role?: string; managementNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const loginId = (body.loginId ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();
  const role = (body.role ?? "").trim();
  const roleVal = ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]) ? role : null;
  const managementNumber = (body.managementNumber ?? "").trim() || `staff-${loginId}`;

  if (!loginId || !password) {
    return NextResponse.json({ error: "로그인 아이디와 비밀번호를 입력하세요." }, { status: 400 });
  }
  if (loginId.length < 2) {
    return NextResponse.json({ error: "아이디는 2자 이상이어야 합니다." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { data: existing } = await db
    .from("site_users")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const password_hash = hashPassword(password);
  const { data: inserted, error } = await db
    .from("site_users")
    .insert({
      login_id: loginId,
      password_hash,
      name: name || null,
      role: roleVal,
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: admin.session.loginId,
      management_number: managementNumber,
    })
    .select("id, login_id, name, role, status")
    .single();

  if (error) {
    console.error("admin members create:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const staffRole = roleVal ?? "직원";
    const level =
      staffRole === "임원" ? 5 :
      staffRole === "변호사" ? 3 :
      staffRole === "사무장" || staffRole === "국장" ? 2 :
      staffRole === "인턴" ? 0 : 1;
    await db.from("staff").upsert(
      [
        {
          login_id: loginId,
          name: name || loginId,
          role: staffRole,
          department: "",
          email: null,
          phone: null,
          approval_level: level,
        },
      ],
      { onConflict: "login_id", ignoreDuplicates: true }
    );
  } catch {
    // staff 테이블 없거나 login_id 컬럼 없으면 무시 (회원은 생성됨)
  }

  return NextResponse.json({
    success: true,
    user: {
      id: inserted.id,
      loginId: inserted.login_id,
      name: inserted.name,
      role: inserted.role,
      status: inserted.status,
    },
  });
}
