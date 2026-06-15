/**
 * 고객(의뢰인) 엑셀 일괄 등록 / 전량 반영
 * FormData: file, replace (optional)
 * guestlist 형식 + 중복 검사 (planClientImport)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import {
  insertClientImportRows,
  loadExistingClientKeys,
  parseClientExcelBuffer,
  planClientImport,
} from "@/lib/clientImportServer";
import { getClientIdentifier, LIMIT_IMPORT_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `import:clients:${getClientIdentifier(request)}`,
    LIMIT_IMPORT_PER_MIN,
    { routePath: "/api/admin/clients/import-excel", source: "upload" }
  );
  if (limited) return limited;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }

  let file: File;
  let replaceMode = false;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File;
    const replaceParam = formData.get("replace");
    replaceMode = replaceParam === "true" || replaceParam === "1";
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "엑셀 파일을 선택해 주세요." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xls") && !file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "엑셀 파일(.xls, .xlsx)만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed: ReturnType<typeof parseClientExcelBuffer>;
  try {
    parsed = parseClientExcelBuffer(buffer);
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!parsed.rows.length) {
    return NextResponse.json({ error: "데이터 행이 없습니다." }, { status: 400 });
  }

  if (replaceMode) {
    const { data: existing } = await db.from("clients").select("id");
    const ids = (existing ?? []).map((r: { id: string }) => r.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await db.from("clients").delete().in("id", chunk);
      if (error) {
        return NextResponse.json({ error: `기존 고객 삭제 실패: ${error.message}` }, { status: 500 });
      }
    }
  }

  const existing = await loadExistingClientKeys(db);
  const plan = planClientImport(parsed.rows, parsed.isGuestlist, existing);

  if (plan.toInsert.length === 0) {
    return NextResponse.json({
      error: "등록할 신규 고객이 없습니다. (중복 또는 빈 행)",
      summary: plan.summary,
    }, { status: 400 });
  }

  try {
    const inserted = await insertClientImportRows(db, plan.toInsert);
    return NextResponse.json({
      success: true,
      count: inserted,
      total: plan.summary.total,
      skippedDb: plan.summary.duplicateDb,
      skippedBatch: plan.summary.duplicateBatch,
      replaced: replaceMode,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "고객 삽입 실패" },
      { status: 500 }
    );
  }
}
