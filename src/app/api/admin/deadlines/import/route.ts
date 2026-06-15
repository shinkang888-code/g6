/**
 * 기일 엑셀(datelist.xls) 업로드 → 기존 기일 전부 삭제 후 엑셀 데이터로 반영
 * POST multipart/form-data: file (.xls / .xlsx)
 */

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { getClientIdentifier, LIMIT_IMPORT_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getDb() {
  return getSupabaseAdmin();
}

function parseProgressDate(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  const match = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 10000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function rowToDeadline(
  row: Record<string, unknown>,
  caseId: string
): { case_id: string; deadline_date: string; deadline_type: string; court: string | null; memo: string | null; is_immutable: boolean; completed_at: string | null } | null {
  const get = (key: string) => row[key] ?? "";
  const trim = (key: string) => String(get(key)).trim();
  const 진행일 = parseProgressDate(get("진행일(요일)"));
  const 기일명 = trim("기일명/내용");
  if (!진행일) return null;

  const dDay = trim("D-일");
  const is_immutable = dDay.includes("불변");
  const 담당자 = trim("출석") || trim("수행");
  const 장소 = trim("장소");
  const 시각 = trim("시각") || trim("약속시간");
  const 등록인 = trim("등록인");
  const 복대리 = trim("복대리");
  const 특이 = trim("▪ 특이사항");
  const 준비기타 = trim("준비사항/기타");
  const 결과 = trim("결과");

  const memoParts = [
    특이,
    준비기타,
    결과,
    담당자 ? `담당자: ${담당자}` : "",
    장소 ? `장소: ${장소}` : "",
    시각 ? `시각: ${시각}` : "",
    등록인 ? `등록인: ${등록인}` : "",
    복대리 ? `복대리: ${복대리}` : "",
  ].filter(Boolean);
  const memo = memoParts.join(" / ").slice(0, 2000) || null;

  return {
    case_id: caseId,
    deadline_date: 진행일,
    deadline_type: 기일명.slice(0, 200) || "기일",
    court: trim("기관") || null,
    memo,
    is_immutable,
    completed_at: 결과 ? new Date().toISOString() : null,
  };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if ("error" in admin) return admin.error;

  const limited = enforceRateLimit(
    request,
    `import:deadlines:${getClientIdentifier(request)}`,
    LIMIT_IMPORT_PER_MIN,
    { routePath: "/api/admin/deadlines/import", source: "upload" }
  );
  if (limited) return limited;

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });
  }

  let file: File;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "엑셀 파일을 선택하세요." }, { status: 400 });
    }
    const name = (file.name ?? "").toLowerCase();
    if (!name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "엑셀 파일(.xls, .xlsx)만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일은 5MB 이하여야 합니다." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽을 수 없습니다." }, { status: 400 });
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  const headers = (rows[0] ?? []) as string[];

  const { data: caseRows } = await db.from("cases").select("id, case_number");
  const caseByNumber = new Map((caseRows ?? []).map((r: { id: string; case_number: string }) => [String(r.case_number).trim(), r.id]));

  const toInsert: Array<Record<string, unknown>> = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const rowArr = rows[i] ?? [];
    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      if (h != null && String(h).trim() !== "") row[h] = rowArr[j];
    });
    const 사건번호 = String(row["사건번호"] ?? "").trim();
    const caseId = caseByNumber.get(사건번호);
    if (!caseId) {
      skipped++;
      continue;
    }
    const d = rowToDeadline(row, caseId);
    if (d) toInsert.push(d);
  }

  let existing: { id: string }[] | null = null;
  const { data: existingData, error: selectError } = await db.from("deadlines").select("id");
  if (selectError) {
    if (selectError.code === "PGRST205" || selectError.message?.includes("Could not find the table")) {
      return NextResponse.json(
        {
          error: "기일 테이블이 없습니다. Supabase 대시보드 → SQL Editor에서 supabase/migrations/20260310110000_ensure_deadlines_table.sql 내용을 실행하세요.",
          code: "DEADLINES_TABLE_MISSING",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: `기일 조회 실패: ${selectError.message}` }, { status: 500 });
  }
  existing = existingData ?? [];

  const ids = existing.map((r: { id: string }) => r.id);
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await db.from("deadlines").delete().in("id", chunk);
      if (error) {
        return NextResponse.json({ error: `기일 삭제 실패: ${error.message}` }, { status: 500 });
      }
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      success: true,
      message: "반영된 기일이 없습니다. 사건번호가 사건 목록에 있는 행만 등록됩니다.",
      count: 0,
      skipped,
    });
  }

  const chunk = 80;
  for (let i = 0; i < toInsert.length; i += chunk) {
    const slice = toInsert.slice(i, i + chunk);
    const { error } = await db.from("deadlines").insert(slice);
    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        return NextResponse.json(
          {
            error: "기일 테이블이 없습니다. Supabase 대시보드 → SQL Editor에서 supabase/migrations/20260310110000_ensure_deadlines_table.sql 내용을 실행하세요.",
            code: "DEADLINES_TABLE_MISSING",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: `기일 삽입 실패: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    message: `기일 ${toInsert.length}건이 반영되었습니다.`,
    count: toInsert.length,
    skipped,
  });
}
