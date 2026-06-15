/**
 * 회사 Drive 폴더 정보 (Google Drive 새 탭 링크)
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { ensureCompanyDriveFolders } from "@/lib/driveCompanyFolders";

export async function GET() {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const folders = await ensureCompanyDriveFolders(auth.managementNumber);

  return NextResponse.json({
    managementNumber: auth.managementNumber,
    rootPath: folders.rootPath,
    sharedPath: folders.sharedPath,
    projectsPath: folders.projectsPath,
    driveFolderUrl: folders.driveFolderUrl,
    rootFolderId: folders.rootFolderId,
    sharedFolderId: folders.sharedFolderId,
    available: Boolean(folders.rootFolderId),
  });
}
