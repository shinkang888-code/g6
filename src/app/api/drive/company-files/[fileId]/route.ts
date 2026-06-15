/**
 * 회사 자료실 파일 삭제·이름변경 (테넌트 검증)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { deleteCompanyFile, renameCompanyFile } from "@/lib/driveCompanyFiles";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const { fileId } = await params;
  if (!fileId?.trim()) {
    return NextResponse.json({ error: "fileId 필요" }, { status: 400 });
  }

  const result = await deleteCompanyFile(auth.db, auth.managementNumber, fileId.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "삭제 실패" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, message: "파일이 삭제되었습니다." });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const { fileId } = await params;
  if (!fileId?.trim()) {
    return NextResponse.json({ error: "fileId 필요" }, { status: 400 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const newName = body.name?.trim();
  if (!newName) {
    return NextResponse.json({ error: "name 이 필요합니다." }, { status: 400 });
  }

  const result = await renameCompanyFile(
    auth.db,
    auth.managementNumber,
    fileId.trim(),
    newName
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "이름 변경 실패" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    file: result.item,
    message: "파일명이 변경되었습니다.",
  });
}
