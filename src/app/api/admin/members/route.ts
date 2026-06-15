/**
 * 회원 목록 조회 (관리자) - 대기/승인 회원
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";

export async function GET() {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const { data, error } = await db
    .from("site_users")
    .select(
      "id, login_id, management_number, status, name, role, department, email, phone, permission_role_id, created_at, approved_at, approved_by, resigned_at, resigned_by, resign_reason"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}
