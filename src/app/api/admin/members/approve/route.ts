/**
 * 회원 일괄 승인 (관리자)
 * body: { ids?: string[], loginIds?: string[] } - id(uuid) 또는 login_id로 지정
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
    return NextResponse.json({ error: "승인할 회원을 선택하거나 아이디를 입력하세요." }, { status: 400 });
  }

  const { error: updateError } = await db
    .from("site_users")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: admin.session.loginId,
    })
    .in("id", targetIds);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // 승인된 회원을 직원(staff) 테이블에 자동 반영 (승인된 계정 = 직원)
  try {
  const { data: approvedUsers } = await db
    .from("site_users")
    .select("id, login_id, name, role")
    .in("id", targetIds)
    .in("status", ["active", "approved"]);

  if (approvedUsers && approvedUsers.length > 0) {
    const roleToLevel = (role: string | null): number => {
      if (!role) return 1;
      if (role === "임원") return 5;
      if (role === "변호사") return 3;
      if (role === "사무장" || role === "국장") return 2;
      if (role === "인턴") return 0;
      return 1;
    };
    const allowedRoles = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"];
    const staffRows = approvedUsers.map((u: { id: string; login_id: string; name: string | null; role: string | null }) => ({
      login_id: u.login_id,
      name: (u.name && u.name.trim()) || u.login_id,
      role: (u.role && allowedRoles.includes(u.role)) ? u.role : "직원",
      department: "",
      email: null,
      phone: null,
      approval_level: roleToLevel(u.role),
    }));
    await db.from("staff").upsert(staffRows, {
      onConflict: "login_id",
      ignoreDuplicates: true,
    });
  }
  } catch {
    // staff 테이블에 login_id가 없거나 스키마 미적용 시 무시 (승인은 유지)
  }

  return NextResponse.json({ success: true, count: targetIds.length });
}
