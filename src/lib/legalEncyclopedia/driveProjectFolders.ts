/**
 * Google Drive — 백과 프로젝트 폴더 트리
 */

import { getDriveClient, getOrCreateFolder, uploadFile } from "@/lib/googleDriveClient";
import { slugifySegment } from "./projectKey";

export const PROJECT_SUBFOLDERS = [
  "01_원본자료",
  "02_판례",
  "03_법령조문",
  "04_백과_벡터",
  "05_모범답안",
  "06_서면초안",
  "07_작업로그",
] as const;

export type ProjectSubfolder = (typeof PROJECT_SUBFOLDERS)[number];

const FEATURE_FOLDER: Record<string, ProjectSubfolder> = {
  case_search: "02_판례",
  doc_summary: "01_원본자료",
  law_search: "03_법령조문",
  ai_search: "04_백과_벡터",
  doc_draft: "06_서면초안",
  legal_encyclopedia: "04_백과_벡터",
  model_answer: "05_모범답안",
  ingest: "04_백과_벡터",
};

export function buildProjectDriveRoot(managementNumber: string, clientName: string, caseTitle: string): string {
  const folderName = `${slugifySegment(clientName)}_${slugifySegment(caseTitle)}`;
  return `projects/${managementNumber}/${folderName}`;
}

export function buildCaseEncyclopediaPath(caseId: string): string {
  return `cases/${caseId}/encyclopedia`;
}

export async function ensureProjectDriveFolders(params: {
  managementNumber: string;
  clientName: string;
  caseTitle: string;
  caseId?: string | null;
}): Promise<{ rootPath: string; rootFolderId: string | null; casePath?: string }> {
  const drive = await getDriveClient();
  if (!drive) {
    return { rootPath: buildProjectDriveRoot(params.managementNumber, params.clientName, params.caseTitle), rootFolderId: null };
  }

  const rootPath = buildProjectDriveRoot(params.managementNumber, params.clientName, params.caseTitle);
  const rootFolderId = await getOrCreateFolder(drive, rootPath);
  if (!rootFolderId) return { rootPath, rootFolderId: null };

  for (const sub of PROJECT_SUBFOLDERS) {
    await getOrCreateFolder(drive, `${rootPath}/${sub}`);
  }

  let casePath: string | undefined;
  if (params.caseId) {
    casePath = buildCaseEncyclopediaPath(params.caseId);
    await getOrCreateFolder(drive, casePath);
  }

  return { rootPath, rootFolderId, casePath };
}

export async function uploadProjectArtifact(params: {
  managementNumber: string;
  clientName: string;
  caseTitle: string;
  sourceFeature: string;
  fileName: string;
  content: string;
  mimeType?: string;
}): Promise<{ fileId: string | null; path: string; webViewLink?: string }> {
  const drive = await getDriveClient();
  const rootPath = buildProjectDriveRoot(params.managementNumber, params.clientName, params.caseTitle);
  const sub = FEATURE_FOLDER[params.sourceFeature] ?? "04_백과_벡터";
  const folderPath = `${rootPath}/${sub}`;

  if (!drive) return { fileId: null, path: folderPath };

  const result = await uploadFile(
    drive,
    folderPath,
    params.fileName,
    Buffer.from(params.content, "utf-8"),
    params.mimeType ?? "text/plain; charset=utf-8"
  );

  return {
    fileId: result?.fileId ?? null,
    path: `${folderPath}/${params.fileName}`,
    webViewLink: result?.webViewLink,
  };
}
