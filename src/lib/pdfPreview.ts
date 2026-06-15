/**
 * PDF/문서 미리보기 유틸
 * - 원본 렌더: pdfjs-dist (브라우저)
 * - OpenDataLoader PDF: 서버 JVM 변환(선택) — /api/pdf/structured
 */

import type { CaseFile } from "@/lib/caseScopedStorage";
import { getDriveFileBlobUrl } from "@/lib/caseFileStorage";

export const VIEWER_STORAGE_KEY = "lawygo_viewer";

export type ViewerPayload = {
  url: string;
  fileName: string;
  mimeType: string;
  /** Drive/DB 파일 ID — 구조 분석 API용 */
  fileId?: string;
  caseId?: string;
};

export function isPdfMime(mimeType?: string, fileName?: string): boolean {
  if (mimeType?.includes("pdf")) return true;
  return (fileName ?? "").toLowerCase().endsWith(".pdf");
}

export function isPreviewableMime(mimeType?: string, fileName?: string): boolean {
  if (!mimeType && !fileName) return false;
  if (isPdfMime(mimeType, fileName)) return true;
  if (mimeType?.startsWith("image/")) return true;
  if (mimeType?.startsWith("text/")) return true;
  return false;
}

/** CaseFile / TimelineAttachment 공통 URL 해석 */
export async function resolveDocumentUrl(file: {
  url?: string;
  driveFileId?: string;
  mimeType?: string;
  fileName?: string;
}): Promise<string | null> {
  if (file.url?.trim()) return file.url;
  if (file.driveFileId) {
    return getDriveFileBlobUrl(file.driveFileId);
  }
  return null;
}

export function openDocumentPreview(payload: ViewerPayload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify(payload));
  window.open("/viewer", "_blank", "noopener,noreferrer,width=960,height=820");
}

export async function openCaseFilePreview(
  file: CaseFile,
  options?: { caseId?: string }
): Promise<void> {
  const url = await resolveDocumentUrl(file);
  if (!url) {
    throw new Error("파일 URL을 가져올 수 없습니다.");
  }
  openDocumentPreview({
    url,
    fileName: file.fileName,
    mimeType: file.mimeType ?? "",
    fileId: file.driveFileId ?? file.id,
    caseId: options?.caseId,
  });
}
