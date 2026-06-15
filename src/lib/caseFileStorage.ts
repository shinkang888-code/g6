/**
 * 사건 자료실 파일 저장소
 * Drive + DB 연동, 미연동 시 로컬 fallback
 */

import type { CaseFile, CaseFolder } from "./caseScopedStorage";

const UPLOAD_PATH = "/api/case-files/upload";
const FILES_PATH = "/api/case-files";
const DOWNLOAD_PATH = "/api/drive/download";

export type StorageMode = "drive" | "local";

export interface DriveUploadResult {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
}

async function parseError(res: Response): Promise<string> {
  const json = await res.json().catch(() => ({}));
  return (json.error as string) || res.statusText;
}

/** 사건별 폴더·파일 목록 (DB) */
export async function fetchCaseDocuments(caseId: string): Promise<{
  files: CaseFile[];
  folders: CaseFolder[];
}> {
  const res = await fetch(`${FILES_PATH}?caseId=${encodeURIComponent(caseId)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { files?: CaseFile[]; folders?: CaseFolder[] };
  return {
    files: json.files ?? [],
    folders: json.folders ?? [],
  };
}

/** Drive 업로드 + DB 저장 (원스텝) */
export async function uploadCaseFile(
  caseId: string,
  file: File,
  folderId?: string | null
): Promise<{ data: CaseFile; storageMode: StorageMode }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("caseId", caseId);
  if (folderId) formData.append("folderId", folderId);

  const res = await fetch(UPLOAD_PATH, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { data: CaseFile; storageMode: StorageMode };
}

/** @deprecated uploadCaseFile 사용 권장 */
export async function uploadCaseFileToDrive(
  caseId: string,
  file: File,
  folderPath = `cases/${caseId}/files`
): Promise<DriveUploadResult | null> {
  const result = await uploadCaseFile(caseId, file);
  return {
    fileId: result.data.driveFileId ?? result.data.id,
    name: result.data.fileName,
    mimeType: result.data.mimeType,
    size: result.data.fileSize,
  };
}

export async function createCaseFolder(caseId: string, name: string): Promise<CaseFolder> {
  const res = await fetch(FILES_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ caseId, type: "folder", name }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: CaseFolder };
  return json.data;
}

export async function updateCaseFileMeta(
  id: string,
  patch: { fileName?: string; folderId?: string | null }
): Promise<CaseFile> {
  const res = await fetch(FILES_PATH, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, type: "file", ...patch }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: CaseFile };
  return json.data;
}

export async function updateCaseFolderMeta(id: string, name: string): Promise<CaseFolder> {
  const res = await fetch(FILES_PATH, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, type: "folder", name }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: CaseFolder };
  return json.data;
}

export async function deleteCaseFileRecord(id: string): Promise<void> {
  const res = await fetch(`${FILES_PATH}?id=${encodeURIComponent(id)}&type=file`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function deleteCaseFolderRecord(id: string): Promise<void> {
  const res = await fetch(`${FILES_PATH}?id=${encodeURIComponent(id)}&type=folder`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseError(res));
}

/** Drive 파일을 Blob URL로 가져와 뷰어에서 사용 */
export async function getDriveFileBlobUrl(fileId: string): Promise<string> {
  const res = await fetch(`${DOWNLOAD_PATH}/${fileId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export type DriveStatus = {
  configured: boolean;
  available: boolean;
  enabled: boolean;
  hasRootFolderId: boolean;
  serviceAccountEmail: string | null;
  hint: string | null;
};

export async function fetchDriveStatus(): Promise<DriveStatus> {
  const res = await fetch("/api/drive/status", { credentials: "include" });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as DriveStatus;
}
