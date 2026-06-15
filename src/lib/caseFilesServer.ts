import type { CaseFile, CaseFolder } from "./caseScopedStorage";

export function caseFileFromRow(r: Record<string, unknown>): CaseFile {
  return {
    id: String(r.id),
    fileName: String(r.file_name ?? ""),
    fileSize: Number(r.file_size ?? 0),
    mimeType: String(r.mime_type ?? "application/octet-stream"),
    url: r.storage_mode === "local" && r.local_data ? String(r.local_data) : "",
    driveFileId: r.drive_file_id ? String(r.drive_file_id) : undefined,
    folderId: r.folder_id ? String(r.folder_id) : undefined,
    local: r.storage_mode === "local",
  };
}

export function caseFolderFromRow(r: Record<string, unknown>): CaseFolder {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    caseId: String(r.case_id ?? ""),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}
