/**
 * 사건 자료실 — Drive 업로드 + DB 저장 (원스텝)
 * POST FormData: file, caseId, folderId?
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import { getDriveClient, uploadFile } from "@/lib/googleDriveClient";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { caseFileFromRow } from "@/lib/caseFilesServer";
import { assertCaseInTenant, resolveManagementNumber } from "@/lib/tenantScope";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_LOCAL_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 미연결" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const caseId = String(formData.get("caseId") ?? "").trim();
  const folderId = String(formData.get("folderId") ?? "").trim() || null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택해 주세요." }, { status: 400 });
  }
  if (!caseId) {
    return NextResponse.json({ error: "caseId가 필요합니다." }, { status: 400 });
  }

  const managementNumber = await resolveManagementNumber(session, db);
  if (!managementNumber) {
    return NextResponse.json({ error: "관리번호(회사)가 설정되지 않았습니다." }, { status: 403 });
  }
  if (!(await assertCaseInTenant(db, caseId, managementNumber))) {
    return NextResponse.json({ error: "해당 사건에 접근할 수 없습니다." }, { status: 403 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "파일은 20MB 이하여야 합니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const fileName = file.name || "file";
  const folderPath = `cases/${caseId}/files`;

  let driveFileId: string | null = null;
  let webViewLink: string | null = null;
  let storageMode: "drive" | "local" = "drive";
  let localData: string | null = null;

  const drive = await getDriveClient();
  if (drive) {
    const result = await uploadFile(drive, folderPath, fileName, buffer, mimeType);
    if (result) {
      driveFileId = result.fileId;
      webViewLink = result.webViewLink ?? null;
    }
  }

  if (!driveFileId) {
    if (file.size > MAX_LOCAL_SIZE) {
      return NextResponse.json(
        {
          error:
            "Google Drive 업로드에 실패했습니다. 5MB 이하 파일만 로컬 저장이 가능합니다. Drive 연동 설정을 확인하세요.",
        },
        { status: 502 }
      );
    }
    storageMode = "local";
    localData = `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  const { data, error } = await db
    .from("case_files")
    .insert({
      case_id: caseId,
      file_name: fileName,
      file_size: file.size,
      mime_type: mimeType,
      folder_id: folderId,
      drive_file_id: driveFileId,
      web_view_link: webViewLink,
      storage_mode: storageMode,
      local_data: localData,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    data: caseFileFromRow(data as Record<string, unknown>),
    storageMode,
  });
}
