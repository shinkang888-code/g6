/**
 * 사건 변경 감사 로그 조회 (관리자)
 * GET ?q=&caseNumber=&clientName=&action=&actor=&from=&to=&page=&page_size=
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import { listCaseAuditLogs } from "@/lib/caseAuditLog";

async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  const db = getSupabaseAdmin();
  if (!db) {
    return { error: NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 }) };
  }
  return { session, db };
}

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { db } = auth;

  const sp = request.nextUrl.searchParams;
  try {
    const result = await listCaseAuditLogs(db, {
      q: sp.get("q") ?? undefined,
      caseNumber: sp.get("caseNumber") ?? sp.get("case_number") ?? undefined,
      clientName: sp.get("clientName") ?? sp.get("client_name") ?? undefined,
      action: sp.get("action") ?? undefined,
      actorLoginId: sp.get("actor") ?? sp.get("actor_login_id") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      page: Number(sp.get("page") ?? "1"),
      pageSize: Number(sp.get("page_size") ?? sp.get("pageSize") ?? "30"),
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 400 }
    );
  }
}
