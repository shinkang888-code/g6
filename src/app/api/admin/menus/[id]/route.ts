/**
 * 관리자: 메뉴 수정 / 삭제
 * DB 연동: getSupabaseAdmin() 사용
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import type { MenuType } from "@/lib/menuService";
import { requireAdminSession } from "@/lib/adminSession";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다. Supabase 환경 변수를 확인하세요." }, { status: 503 });
  }
  const { id } = await params;
  let body: { type?: MenuType; item_id?: string; label?: string; href?: string; icon?: string; item_order?: number; badge?: number; roles?: string[]; lawtop_module?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if (body.type !== undefined) update.type = body.type;
  if (body.item_id !== undefined) update.item_id = body.item_id;
  if (body.label !== undefined) update.label = body.label;
  if (body.href !== undefined) update.href = body.href;
  if (body.icon !== undefined) update.icon = body.icon;
  if (body.item_order !== undefined) update.item_order = body.item_order;
  if (body.badge !== undefined) update.badge = body.badge;
  if (body.roles !== undefined) update.roles = body.roles;
  if (body.lawtop_module !== undefined) update.lawtop_module = body.lawtop_module;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
  }
  const { data, error } = await db
    .from("site_menus")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다. Supabase 환경 변수를 확인하세요." }, { status: 503 });
  }
  const { id } = await params;
  const { error } = await db.from("site_menus").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
