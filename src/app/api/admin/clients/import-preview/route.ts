/**
 * 고객 엑셀 import 미리보기 (LawTop guestlist — 중복 검사)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/authSession";
import {
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
    `import:clients-preview:${getClientIdentifier(request)}`,
    LIMIT_IMPORT_PER_MIN,
    { routePath: "/api/admin/clients/import-preview", source: "upload" }
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
  try {
    const formData = await request.formData();
    file = formData.get("file") as File;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "엑셀 파일을 선택해 주세요." }, { status: 400 });
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

  const existing = await loadExistingClientKeys(db);
  const plan = planClientImport(parsed.rows, parsed.isGuestlist, existing);

  return NextResponse.json({
    isGuestlist: parsed.isGuestlist,
    plan,
  });
}
