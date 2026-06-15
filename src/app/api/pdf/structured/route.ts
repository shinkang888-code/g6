/**
 * PDF 구조 분석 API (OpenDataLoader PDF 연동 — 선택)
 * POST multipart: file (PDF)
 * 또는 JSON: { driveFileId } — Drive에서 PDF 다운로드 후 변환
 *
 * OPENDATALOADER_SERVICE_URL 미설정 시 503 + 안내 메시지
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { convertViaOpenDataLoader } from "@/lib/openDataLoaderBridge";
import { getDriveClient, getFileBuffer } from "@/lib/googleDriveClient";
import { getClientIdentifier, LIMIT_PDF_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const limited = enforceRateLimit(
    request,
    `pdf:structured:${auth.session.userId || getClientIdentifier(request)}`,
    LIMIT_PDF_PER_MIN,
    { routePath: "/api/pdf/structured", source: "api" }
  );
  if (limited) return limited;

  let buffer: Buffer | null = null;
  let fileName = "document.pdf";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF 파일만 지원합니다." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "PDF는 10MB 이하여야 합니다." }, { status: 400 });
    }
    buffer = Buffer.from(await file.arrayBuffer());
    fileName = file.name;
  } else {
    let body: { driveFileId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const driveFileId = body.driveFileId?.trim();
    if (!driveFileId) {
      return NextResponse.json({ error: "file 또는 driveFileId가 필요합니다." }, { status: 400 });
    }
    const drive = await getDriveClient();
    if (!drive) {
      return NextResponse.json({ error: "Drive가 연결되지 않았습니다." }, { status: 503 });
    }
    const downloaded = await getFileBuffer(drive, driveFileId);
    if (!downloaded?.buffer) {
      return NextResponse.json({ error: "Drive에서 PDF를 다운로드할 수 없습니다." }, { status: 404 });
    }
    if (downloaded.buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "PDF는 10MB 이하여야 합니다." }, { status: 400 });
    }
    buffer = downloaded.buffer;
    fileName = downloaded.fileName ?? "document.pdf";
  }

  const format = (request.nextUrl.searchParams.get("format") ?? "html") as "html" | "markdown" | "json";
  const result = await convertViaOpenDataLoader(buffer, fileName, format);

  if (result.source === "unavailable") {
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result);
}
