/**
 * 결재관리: 관리번호/관리명, 자료실(폴더·파일) localStorage
 */

export interface ApprovalDocMeta {
  managementNumber: string;
  managementName: string;
}

export interface ApprovalArchiveFolder {
  id: string;
  name: string;
}

export interface ApprovalArchiveItem {
  id: string;
  approvalDocId: string;
  folderId: string | null;
  displayName: string;
}

const KEY_META = "lawygo_approval_meta";
const KEY_ARCHIVES = "lawygo_approval_archives";

export function loadApprovalMeta(): Record<string, ApprovalDocMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY_META);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveApprovalMeta(meta: Record<string, ApprovalDocMeta>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_META, JSON.stringify(meta));
  } catch {}
}

/** 결재완료 문서 목록(날짜순)에서 동일일 그룹 내 순번으로 관리번호 생성 (YYMMDD001) */
export function getOrCreateManagementNumber(
  docId: string,
  completedAt: string,
  existingMeta: Record<string, ApprovalDocMeta>,
  sameDaySortedDocIds: string[]
): string {
  const existing = existingMeta[docId]?.managementNumber;
  if (existing) return existing;
  const dateStr = completedAt.slice(0, 10).replace(/-/g, "");
  const yy = dateStr.slice(2, 4);
  const mm = dateStr.slice(4, 6);
  const dd = dateStr.slice(6, 8);
  const idx = sameDaySortedDocIds.indexOf(docId);
  const seq = String((idx >= 0 ? idx : 0) + 1).padStart(3, "0");
  return `${yy}${mm}${dd}${seq}`;
}

export interface ApprovalArchivesState {
  folders: ApprovalArchiveFolder[];
  items: ApprovalArchiveItem[];
}

export function loadApprovalArchives(): ApprovalArchivesState {
  if (typeof window === "undefined") return { folders: [], items: [] };
  try {
    const raw = localStorage.getItem(KEY_ARCHIVES);
    if (!raw) return { folders: [], items: [] };
    const parsed = JSON.parse(raw) as ApprovalArchivesState;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { folders: [], items: [] };
  }
}

export function saveApprovalArchives(state: ApprovalArchivesState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_ARCHIVES, JSON.stringify(state));
  } catch {}
}
