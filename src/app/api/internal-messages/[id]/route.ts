/**
 * 사내 메신저 — 읽음 처리
 * PATCH { read: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import { messageFromRow } from "@/lib/internalMessageServer";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  const { id } = await params;
  const { data: existing, error: loadErr } = await db
    .from("internal_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
  }

  const rid = String(existing.recipient_id ?? "");
  const rLogin = String(existing.recipient_login_id ?? "").toLowerCase();
  const isRecipient =
    rid === session.userId ||
    (rLogin && rLogin === session.loginId.toLowerCase());

  if (!isRecipient) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { data, error } = await db
    .from("internal_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: messageFromRow(data as Record<string, unknown>) });
}
