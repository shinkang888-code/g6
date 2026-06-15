/**
 * 법률백과 문서 조회수 기록
 * POST { documentKey, title, category, vectorId? }
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { resolveManagementNumber } from "@/lib/tenantScope";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { incrementDocumentView } from "@/lib/legalEncyclopedia/documentStats";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 연결 실패" }, { status: 503 });
  }

  const managementNumber = await resolveManagementNumber(auth.session, db);
  if (!managementNumber) {
    return NextResponse.json({ error: "관리번호 미설정" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const documentKey = String(body.documentKey ?? "").trim();
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "").trim();
  if (!documentKey || !title) {
    return NextResponse.json({ error: "documentKey, title 필요" }, { status: 400 });
  }

  try {
    const viewCount = await incrementDocumentView(db, {
      managementNumber,
      documentKey,
      title,
      category,
      vectorId: body.vectorId ? String(body.vectorId) : null,
    });
    return NextResponse.json({ ok: true, viewCount });
  } catch (e) {
    console.error("[document-view]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회수 기록 실패" },
      { status: 500 }
    );
  }
}
