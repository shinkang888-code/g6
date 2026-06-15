/**
 * 회사 자료실 — 파일 업로드
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { ensureCompanyDriveFolders, buildCompanySharedPath } from "@/lib/driveCompanyFolders";
import { getDriveClient, uploadFile, DriveUploadError } from "@/lib/googleDriveClient";

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const drive = await getDriveClient();
  if (!drive) {
    return NextResponse.json(
      { error: "Google Drive 연동이 필요합니다." },
      { status: 503 }
    );
  }

  await ensureCompanyDriveFolders(auth.managementNumber);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택하세요." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "20MB 이하 파일만 업로드 가능합니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const folderPath = buildCompanySharedPath(auth.managementNumber);
  try {
    const result = await uploadFile(
      drive,
      folderPath,
      file.name || `upload-${Date.now()}`,
      buffer,
      file.type || "application/octet-stream"
    );

    if (!result?.fileId) {
      return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 502 });
    }

    return NextResponse.json({
      fileId: result.fileId,
      name: result.name,
      mimeType: result.mimeType,
      size: result.size,
      path: `${folderPath}/${result.name}`,
      message: "자료실에 업로드되었습니다.",
    });
  } catch (e) {
    if (e instanceof DriveUploadError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.code === "STORAGE_QUOTA_SETUP" ? 422 : 403 }
      );
    }
    const msg = e instanceof Error ? e.message : "업로드 중 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
