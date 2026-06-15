/**
 * Google Drive 파일 다운로드
 * GET /api/drive/download/[fileId]
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import { getDriveClient, getFileBuffer } from "@/lib/googleDriveClient";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId?.trim()) {
    return NextResponse.json({ error: "fileId가 필요합니다." }, { status: 400 });
  }

  const drive = await getDriveClient();
  if (!drive) {
    return NextResponse.json(
      { error: "Google Drive 연동이 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const fileData = await getFileBuffer(drive, fileId.trim());
  if (!fileData) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const fileName = fileData.fileName || "download";
  const mimeType = fileData.mimeType || "application/octet-stream";

  const body = new Uint8Array(fileData.buffer);
  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
