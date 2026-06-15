/**
 * 회사 자료실 — Drive 파일 통합 목록·권한 검증
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDriveClient,
  listAllFilesUnderPath,
  getFileMetadata,
  trashDriveFile,
  renameDriveFile,
  type DriveFileEntry,
} from "./googleDriveClient";
import {
  ensureCompanyDriveFolders,
  buildCompanySharedPath,
  buildCompanyProjectsPath,
  isPathUnderTenant,
  type CompanyDriveFolders,
} from "./driveCompanyFolders";

export type CompanyFileItem = {
  fileId: string;
  name: string;
  displayName: string;
  mimeType: string;
  size?: number;
  source: "company_shared" | "company_projects" | "case_files";
  relativePath: string;
  createdTime?: string;
  modifiedTime?: string;
  caseId?: string;
  caseNumber?: string;
  webViewLink?: string;
};

export type CompanyFilesResult = {
  available: boolean;
  folders: CompanyDriveFolders | null;
  files: CompanyFileItem[];
  total: number;
  message?: string;
};

function toCompanyItem(
  f: DriveFileEntry,
  source: CompanyFileItem["source"],
  basePath: string
): CompanyFileItem {
  const rel = f.name.startsWith(basePath) ? f.name.slice(basePath.length).replace(/^\//, "") : f.name;
  const displayName = rel.includes("/") ? rel.split("/").pop() ?? rel : rel;
  return {
    fileId: f.fileId,
    name: f.name,
    displayName,
    mimeType: f.mimeType,
    size: f.size,
    source,
    relativePath: rel,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
  };
}

export async function listCompanyFiles(
  db: SupabaseClient,
  managementNumber: string,
  searchQuery?: string
): Promise<CompanyFilesResult> {
  const folders = await ensureCompanyDriveFolders(managementNumber);
  const drive = await getDriveClient();

  if (!drive) {
    return {
      available: false,
      folders,
      files: [],
      total: 0,
      message: "Google Drive 연동이 필요합니다. 관리자 > 시스템 설정 > Google Drive에서 설정하세요.",
    };
  }

  const items: CompanyFileItem[] = [];
  const seen = new Set<string>();

  const [shared, projects] = await Promise.all([
    listAllFilesUnderPath(drive, buildCompanySharedPath(managementNumber), 300),
    listAllFilesUnderPath(drive, buildCompanyProjectsPath(managementNumber), 300),
  ]);

  for (const f of shared.files) {
    if (seen.has(f.fileId)) continue;
    seen.add(f.fileId);
    items.push(toCompanyItem(f, "company_shared", shared.basePath));
  }
  for (const f of projects.files) {
    if (seen.has(f.fileId)) continue;
    seen.add(f.fileId);
    items.push(toCompanyItem(f, "company_projects", projects.basePath));
  }

  const { data: cases } = await db
    .from("cases")
    .select("id, case_number")
    .eq("management_number", managementNumber)
    .limit(200);

  const caseIds = (cases ?? []).map((c) => c.id as string);
  if (caseIds.length > 0) {
    const { data: caseFileRows } = await db
      .from("case_files")
      .select("id, file_name, mime_type, file_size, drive_file_id, case_id, created_at")
      .in("case_id", caseIds)
      .not("drive_file_id", "is", null)
      .limit(200);

    const caseMap = new Map((cases ?? []).map((c) => [c.id, c.case_number as string]));

    for (const row of caseFileRows ?? []) {
      const fid = String(row.drive_file_id ?? "");
      if (!fid || seen.has(fid)) continue;
      seen.add(fid);
      items.push({
        fileId: fid,
        name: String(row.file_name ?? ""),
        displayName: String(row.file_name ?? ""),
        mimeType: String(row.mime_type ?? "application/octet-stream"),
        size: Number(row.file_size ?? 0) || undefined,
        source: "case_files",
        relativePath: `cases/${caseMap.get(row.case_id as string) ?? row.case_id}/${row.file_name}`,
        createdTime: row.created_at ? String(row.created_at) : undefined,
        caseId: String(row.case_id ?? ""),
        caseNumber: caseMap.get(row.case_id as string),
      });
    }

    // Drive에만 있고 DB 미등록 사건 자료 (최대 20건)
    const scanIds = caseIds.slice(0, 20);
    for (const caseId of scanIds) {
      const caseNumber = caseMap.get(caseId) ?? caseId;
      const { files: driveCaseFiles } = await listAllFilesUnderPath(
        drive,
        `cases/${caseId}/files`,
        30
      );
      for (const f of driveCaseFiles) {
        if (seen.has(f.fileId)) continue;
        seen.add(f.fileId);
        items.push({
          fileId: f.fileId,
          name: f.name,
          displayName: f.name.includes("/") ? f.name.split("/").pop() ?? f.name : f.name,
          mimeType: f.mimeType,
          size: f.size,
          source: "case_files",
          relativePath: `cases/${caseNumber}/${f.name}`,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          caseId,
          caseNumber,
          webViewLink: f.webViewLink,
        });
      }
    }
  }

  const q = searchQuery?.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          f.relativePath.toLowerCase().includes(q) ||
          (f.caseNumber?.toLowerCase().includes(q) ?? false)
      )
    : items;

  filtered.sort((a, b) => (b.modifiedTime ?? b.createdTime ?? "").localeCompare(a.modifiedTime ?? a.createdTime ?? ""));

  return {
    available: true,
    folders,
    files: filtered,
    total: filtered.length,
  };
}

/** 파일이 해당 테넌트 소유인지 검증 */
export async function assertTenantOwnsDriveFile(
  db: SupabaseClient,
  managementNumber: string,
  fileId: string
): Promise<{ ok: boolean; item?: CompanyFileItem; error?: string }> {
  const drive = await getDriveClient();
  if (!drive) return { ok: false, error: "Drive 미연동" };

  const list = await listCompanyFiles(db, managementNumber);
  const found = list.files.find((f) => f.fileId === fileId);
  if (found) return { ok: true, item: found };

  const meta = await getFileMetadata(drive, fileId);
  if (!meta) return { ok: false, error: "파일을 찾을 수 없습니다." };

  for (const prefix of [managementNumber, `projects/${managementNumber}`, buildCompanySharedPath(managementNumber)]) {
    if (meta.name.includes(prefix) || isPathUnderTenant(meta.name, managementNumber)) {
      return { ok: true, item: toCompanyItem(meta, "company_shared", prefix) };
    }
  }

  const { data: caseFile } = await db
    .from("case_files")
    .select("drive_file_id, case_id, file_name")
    .eq("drive_file_id", fileId)
    .maybeSingle();

  if (caseFile?.case_id) {
    const { data: caseRow } = await db
      .from("cases")
      .select("management_number")
      .eq("id", caseFile.case_id)
      .maybeSingle();
    if (caseRow?.management_number === managementNumber) {
      return {
        ok: true,
        item: {
          fileId,
          name: String(caseFile.file_name),
          displayName: String(caseFile.file_name),
          mimeType: meta.mimeType,
          source: "case_files",
          relativePath: String(caseFile.file_name),
          caseId: String(caseFile.case_id),
        },
      };
    }
  }

  return { ok: false, error: "이 회사의 파일이 아닙니다." };
}

export async function deleteCompanyFile(
  db: SupabaseClient,
  managementNumber: string,
  fileId: string
): Promise<{ ok: boolean; error?: string }> {
  const check = await assertTenantOwnsDriveFile(db, managementNumber, fileId);
  if (!check.ok) return { ok: false, error: check.error };

  const drive = await getDriveClient();
  if (!drive) return { ok: false, error: "Drive 미연동" };

  const trashed = await trashDriveFile(drive, fileId);
  if (!trashed) return { ok: false, error: "삭제에 실패했습니다." };

  if (check.item?.source === "case_files") {
    await db.from("case_files").delete().eq("drive_file_id", fileId);
  }

  return { ok: true };
}

/** 파일명 변경 (Drive + 사건자료 DB 동기화) */
export async function renameCompanyFile(
  db: SupabaseClient,
  managementNumber: string,
  fileId: string,
  newName: string
): Promise<{ ok: boolean; item?: CompanyFileItem; error?: string }> {
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, error: "파일명을 입력하세요." };
  if (trimmed.length > 200) return { ok: false, error: "파일명은 200자 이하여야 합니다." };

  const check = await assertTenantOwnsDriveFile(db, managementNumber, fileId);
  if (!check.ok) return { ok: false, error: check.error };

  const drive = await getDriveClient();
  if (!drive) return { ok: false, error: "Drive 미연동" };

  const renamed = await renameDriveFile(drive, fileId, trimmed);
  if (!renamed) return { ok: false, error: "파일명 변경에 실패했습니다." };

  if (check.item?.source === "case_files") {
    await db
      .from("case_files")
      .update({ file_name: renamed.name, updated_at: new Date().toISOString() })
      .eq("drive_file_id", fileId);
  }

  const updated: CompanyFileItem = {
    ...(check.item ?? {
      fileId,
      name: renamed.name,
      displayName: renamed.name,
      mimeType: renamed.mimeType,
      source: "company_shared" as const,
      relativePath: renamed.name,
    }),
    name: renamed.name,
    displayName: renamed.name,
    mimeType: renamed.mimeType,
    size: renamed.size,
    modifiedTime: renamed.modifiedTime,
    webViewLink: renamed.webViewLink,
  };

  return { ok: true, item: updated };
}
