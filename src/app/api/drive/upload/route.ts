/**
 * Google Drive 파일 업로드
 * POST FormData: file (File), folderPath (string)
 * folderPath: cases/{caseId}/files | messenger/attachments | approval/{docId}
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import { getDriveClient, uploadFile } from "@/lib/googleDriveClient";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_PATHS = /^(cases\/[^/]+\/(files|encyclopedia)(\/.*)?|projects\/[^/]+\/.+|messenger\/attachments|approval\/[^/]+|site\/banners)$/;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const drive = await getDriveClient();
  if (!drive) {
    return NextResponse.json(
      { error: "Google Drive 연동이 설정되지 않았습니다. GOOGLE_DRIVE_CREDENTIALS_BASE64를 확인하세요." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const folderPath = String(formData.get("folderPath") ?? "").trim();

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택해 주세요." }, { status: 400 });
  }
  if (!folderPath || !ALLOWED_PATHS.test(folderPath)) {
    return NextResponse.json(
      { error: "유효한 folderPath가 필요합니다. (예: cases/123/files, messenger/attachments, approval/doc1)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const fileName = file.name || "file";

  const result = await uploadFile(drive, folderPath, fileName, buffer, mimeType);
  if (!result) {
    return NextResponse.json(
      { error: "Drive 업로드에 실패했습니다." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    fileId: result.fileId,
    name: result.name,
    mimeType: result.mimeType,
    size: result.size,
    webViewLink: result.webViewLink,
  });
}
