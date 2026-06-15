/**
 * 관리자: 메뉴 목록 조회 / 메뉴 추가
 * DB 연동: getSupabaseAdmin() 사용 (service role, RLS 우회)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getMenuRowsForAdmin } from "@/lib/menuService";
import { requireAdminSession } from "@/lib/adminSession";
import {
  LNB_MENU,
  MOBILE_MAIN_MENU,
  MOBILE_MORE_MENU,
} from "@/lib/menuConfig";
import type { MenuType } from "@/lib/menuService";

function defaultRows(): { type: MenuType; item_order: number; item_id: string; label: string; href: string; icon: string; badge?: number; roles?: string[]; lawtop_module?: string }[] {
  const rows: { type: MenuType; item_order: number; item_id: string; label: string; href: string; icon: string; badge?: number; roles?: string[]; lawtop_module?: string }[] = [];
  LNB_MENU.forEach((m, i) => rows.push({ type: "lnb", item_order: i, item_id: m.id, label: m.label, href: m.href, icon: m.icon, badge: m.badge, roles: m.roles, lawtop_module: m.lawtopModule }));
  MOBILE_MAIN_MENU.forEach((m, i) => rows.push({ type: "mobile_main", item_order: i, item_id: m.id, label: m.label, href: m.href, icon: m.icon, badge: m.badge }));
  MOBILE_MORE_MENU.forEach((m, i) => rows.push({ type: "mobile_more", item_order: i, item_id: m.id, label: m.label, href: m.href, icon: m.icon }));
  return rows;
}

export async function GET() {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  try {
    const rows = await getMenuRowsForAdmin();
    if (rows && rows.length > 0) {
      return NextResponse.json({ data: rows, source: "db" });
    }
    return NextResponse.json({ data: defaultRows(), source: "default" });
  } catch (e) {
    return NextResponse.json({ data: defaultRows(), source: "default" });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다. Supabase 환경 변수를 확인하세요." }, { status: 503 });
  }
  let body: { type: MenuType; item_id: string; label: string; href: string; icon: string; item_order?: number; badge?: number; roles?: string[]; lawtop_module?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const { type, item_id, label, href, icon, item_order, badge, roles, lawtop_module } = body;
  if (!type || !item_id || !label || !href || !icon) {
    return NextResponse.json({ error: "type, item_id, label, href, icon 은 필수입니다." }, { status: 400 });
  }
  const order = typeof item_order === "number" ? item_order : 999;
  const { data, error } = await db
    .from("site_menus")
    .insert({
      type,
      item_id,
      label,
      href,
      icon,
      item_order: order,
      badge: badge ?? null,
      roles: roles ?? [],
      lawtop_module: lawtop_module ?? null,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

/** 전체 메뉴 일괄 저장: 기존 삭제 후 현재 목록 전부 INSERT */
export async function PUT(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다. Supabase 환경 변수를 확인하세요." }, { status: 503 });
  }
  let body: { data: { type: MenuType; item_order: number; item_id: string; label: string; href: string; icon: string; badge?: number | null; roles?: string[] | null; lawtop_module?: string | null }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const items = Array.isArray(body.data) ? body.data : [];
  for (const row of items) {
    if (!row.type || !row.item_id || !row.label || !row.href || !row.icon) {
      return NextResponse.json(
        { error: "각 항목에 type, item_id, label, href, icon 이 필요합니다." },
        { status: 400 }
      );
    }
  }

  const { data: existing } = await db.from("site_menus").select("id");
  if (existing && existing.length > 0) {
    const { error: delError } = await db.from("site_menus").delete().in("id", existing.map((r) => r.id));
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 400 });
    }
  }

  if (items.length === 0) {
    return NextResponse.json({ data: [], source: "db" });
  }

  const inserts = items.map((row) => ({
    type: row.type,
    item_id: row.item_id,
    label: row.label,
    href: row.href,
    icon: row.icon,
    item_order: typeof row.item_order === "number" ? row.item_order : 999,
    badge: row.badge ?? null,
    roles: row.roles ?? [],
    lawtop_module: row.lawtop_module ?? null,
  }));

  const { data: inserted, error: insertError } = await db
    .from("site_menus")
    .insert(inserts)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }
  return NextResponse.json({ data: inserted ?? [], source: "db" });
}
