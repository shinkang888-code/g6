/**
 * 알림 API (LawTop ChatNoti / MessageNoti 방식)
 * GET — 내 알림 목록
 * PATCH { ids?: string[], all?: boolean } — 읽음 처리
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import { notificationFromRow } from "@/lib/notificationServer";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const { data, error } = await db
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${session.userId},recipient_login_id.eq.${session.loginId}`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = (data ?? []).map((r) => notificationFromRow(r as Record<string, unknown>));
  const unreadCount = list.filter((n) => !n.isRead).length;

  return NextResponse.json({ data: list, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  let body: { ids?: string[]; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const patch = { is_read: true };

  if (body.all) {
    const { error } = await db
      .from("notifications")
      .update(patch)
      .or(`user_id.eq.${session.userId},recipient_login_id.eq.${session.loginId}`)
      .eq("is_read", false);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const ids = body.ids ?? [];
  if (!ids.length) {
    return NextResponse.json({ error: "ids 또는 all 필요" }, { status: 400 });
  }

  const { error } = await db.from("notifications").update(patch).in("id", ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
