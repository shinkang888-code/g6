/**
 * 회사(관리번호) 단위 Google Drive 폴더
 * LawyGo/{management_number}/ — 회사 루트
 * LawyGo/{management_number}/자료실/ — 공유 자료실
 */

import {
  getDriveClient,
  getOrCreateFolder,
  shareFolderWithCompanyLink,
  buildDriveFolderUrl,
} from "./googleDriveClient";

export const COMPANY_SHARED_SUBFOLDER = "자료실";

export function buildCompanyRootPath(managementNumber: string): string {
  return managementNumber.trim();
}

export function buildCompanySharedPath(managementNumber: string): string {
  return `${buildCompanyRootPath(managementNumber)}/${COMPANY_SHARED_SUBFOLDER}`;
}

export function buildCompanyProjectsPath(managementNumber: string): string {
  return `projects/${managementNumber.trim()}`;
}

export type CompanyDriveFolders = {
  managementNumber: string;
  rootPath: string;
  sharedPath: string;
  projectsPath: string;
  rootFolderId: string | null;
  sharedFolderId: string | null;
  driveFolderUrl: string | null;
};

export async function ensureCompanyDriveFolders(
  managementNumber: string
): Promise<CompanyDriveFolders> {
  const mn = managementNumber.trim();
  const rootPath = buildCompanyRootPath(mn);
  const sharedPath = buildCompanySharedPath(mn);
  const projectsPath = buildCompanyProjectsPath(mn);

  const drive = await getDriveClient();
  if (!drive) {
    return {
      managementNumber: mn,
      rootPath,
      sharedPath,
      projectsPath,
      rootFolderId: null,
      sharedFolderId: null,
      driveFolderUrl: null,
    };
  }

  const rootFolderId = await getOrCreateFolder(drive, rootPath);
  const sharedFolderId = rootFolderId ? await getOrCreateFolder(drive, sharedPath) : null;
  await getOrCreateFolder(drive, projectsPath);

  if (rootFolderId) {
    await shareFolderWithCompanyLink(drive, rootFolderId);
  }

  return {
    managementNumber: mn,
    rootPath,
    sharedPath,
    projectsPath,
    rootFolderId,
    sharedFolderId,
    driveFolderUrl: rootFolderId ? buildDriveFolderUrl(rootFolderId) : null,
  };
}

/** 테넌트 소유 경로 접두사 */
export function tenantDrivePathPrefixes(managementNumber: string): string[] {
  const mn = managementNumber.trim();
  return [mn, `projects/${mn}`, buildCompanySharedPath(mn)];
}

export function isPathUnderTenant(path: string, managementNumber: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const prefixes = tenantDrivePathPrefixes(managementNumber);
  return prefixes.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}
