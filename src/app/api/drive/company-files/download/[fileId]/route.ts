/**
 * 회사 자료실 파일 미리보기/다운로드 (테넌트 검증)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { assertTenantOwnsDriveFile } from "@/lib/driveCompanyFiles";
import { getDriveClient, getFileBuffer } from "@/lib/googleDriveClient";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const { fileId } = await params;
  if (!fileId?.trim()) {
    return NextResponse.json({ error: "fileId 필요" }, { status: 400 });
  }

  const check = await assertTenantOwnsDriveFile(auth.db, auth.managementNumber, fileId.trim());
  if (!check.ok) {
    return NextResponse.json({ error: check.error ?? "접근 거부" }, { status: 403 });
  }

  const drive = await getDriveClient();
  if (!drive) {
    return NextResponse.json({ error: "Drive 미연동" }, { status: 503 });
  }

  const fileData = await getFileBuffer(drive, fileId.trim());
  if (!fileData) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const fileName = fileData.fileName || check.item?.displayName || "download";
  const mimeType = fileData.mimeType || "application/octet-stream";
  const disposition = inline
    ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
    : `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;

  return new NextResponse(new Uint8Array(fileData.buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=300",
    },
  });
}
