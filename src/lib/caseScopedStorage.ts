/**
 * 사건별 독립 데이터(메모, 자료실 파일·폴더) 저장/로드
 * localStorage 기반으로 새로고침 후에도 유지
 */

import type { Timeline, TimelineAttachment } from "./types";

const STORAGE_KEYS = {
  memos: "lawygo_case_memos",
  files: "lawygo_case_files",
  folders: "lawygo_case_folders",
} as const;

export const CASE_MEMO_CHANGED_MESSAGE_TYPE = "LAWYGO_CASE_MEMO_CHANGED";
export const CASE_MEMO_SYNC_CHANNEL = "lawygo-case-memo-sync";

export type CaseMemoChangedMessage = {
  type: typeof CASE_MEMO_CHANGED_MESSAGE_TYPE;
  caseId: string;
};

export interface CaseFile extends TimelineAttachment {
  local?: boolean;
  folderId?: string | null;
  /** Drive 저장 시 파일 ID (메타만 localStorage) */
  driveFileId?: string;
}

export interface CaseFolder {
  id: string;
  name: string;
  caseId: string;
  createdAt: string;
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("caseScopedStorage save failed", key, e);
  }
}

export type CaseMemosMap = Record<string, Timeline[]>;
export type CaseFilesMap = Record<string, CaseFile[]>;
export type CaseFoldersMap = Record<string, CaseFolder[]>;

/** mockTimeline에서 사건별 메모만 추출 */
export function getInitialMemosFromMock(mockTimeline: Timeline[]): CaseMemosMap {
  const map: CaseMemosMap = {};
  mockTimeline
    .filter((t) => t.type === "memo")
    .forEach((t) => {
      if (!map[t.caseId]) map[t.caseId] = [];
      map[t.caseId].push({ ...t });
    });
  return map;
}

/** mockTimeline에서 사건별 첨부파일만 추출 (flat) */
export function getInitialFilesFromMock(mockTimeline: Timeline[]): CaseFilesMap {
  const map: CaseFilesMap = {};
  mockTimeline.forEach((t) => {
    if (!t.attachments?.length) return;
    if (!map[t.caseId]) map[t.caseId] = [];
    t.attachments.forEach((a) => {
      map[t.caseId].push({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        url: a.url,
      });
    });
  });
  return map;
}

export function loadCaseMemos(initialFromMock: CaseMemosMap): CaseMemosMap {
  const stored = loadJson<CaseMemosMap>(STORAGE_KEYS.memos, {});
  return { ...initialFromMock, ...stored };
}

export function loadCaseFiles(initialFromMock: CaseFilesMap): CaseFilesMap {
  const stored = loadJson<CaseFilesMap>(STORAGE_KEYS.files, {});
  return { ...initialFromMock, ...stored };
}

export function loadCaseFolders(): CaseFoldersMap {
  return loadJson<CaseFoldersMap>(STORAGE_KEYS.folders, {});
}

export function saveCaseMemos(map: CaseMemosMap) {
  saveJson(STORAGE_KEYS.memos, map);
}

function notifyCaseMemoChanged(caseId: string) {
  if (typeof window === "undefined" || !caseId) return;
  const message: CaseMemoChangedMessage = {
    type: CASE_MEMO_CHANGED_MESSAGE_TYPE,
    caseId,
  };
  window.dispatchEvent(new CustomEvent(CASE_MEMO_CHANGED_MESSAGE_TYPE, { detail: message }));
  try {
    const channel = new BroadcastChannel(CASE_MEMO_SYNC_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // ignore
  }
}

/** 사건별 메모 저장 — localStorage 최신값 병합 후 다른 창·탭에 알림 */
export function persistCaseMemos(
  caseId: string,
  memos: Timeline[],
  initialFromMock: CaseMemosMap
): Timeline[] {
  const all = loadCaseMemos(initialFromMock);
  const next = { ...all, [caseId]: memos };
  saveCaseMemos(next);
  notifyCaseMemoChanged(caseId);
  return memos;
}

/** 저장소에서 사건별 메모 최신 목록 조회 */
export function readCaseMemosForCase(caseId: string, initialFromMock: CaseMemosMap): Timeline[] {
  const all = loadCaseMemos(initialFromMock);
  return all[caseId] ?? [];
}

/** 다른 창(상세보기 팝업 등)에서 메모가 바뀌면 콜백 호출 */
export function subscribeCaseMemoChanges(onChange: (caseId: string) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleMessage = (event: MessageEvent<CaseMemoChangedMessage>) => {
    const data = event.data;
    if (data?.type === CASE_MEMO_CHANGED_MESSAGE_TYPE && data.caseId) {
      onChange(data.caseId);
    }
  };

  const handleCustom = (event: Event) => {
    const caseId = (event as CustomEvent<CaseMemoChangedMessage>).detail?.caseId;
    if (caseId) onChange(caseId);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.memos) {
      onChange("");
    }
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CASE_MEMO_SYNC_CHANNEL);
    channel.onmessage = handleMessage;
  } catch {
    // ignore
  }

  window.addEventListener(CASE_MEMO_CHANGED_MESSAGE_TYPE, handleCustom);
  window.addEventListener("storage", handleStorage);

  return () => {
    channel?.close();
    window.removeEventListener(CASE_MEMO_CHANGED_MESSAGE_TYPE, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveCaseFiles(map: CaseFilesMap) {
  saveJson(STORAGE_KEYS.files, map);
}

export function saveCaseFolders(map: CaseFoldersMap) {
  saveJson(STORAGE_KEYS.folders, map);
}

/** 법원기일연동 자동 메모 ID */
export function courtSyncMemoId(caseId: string): string {
  return `court-sync-deadline-${caseId}`;
}

/** localStorage에 저장된 사건별 메모만 조회 */
export function getStoredCaseMemos(caseId: string): Timeline[] {
  const stored = loadJson<CaseMemosMap>(STORAGE_KEYS.memos, {});
  return stored[caseId] ?? [];
}

/** 사건별 메모 1건 추가 또는 동일 id면 갱신 */
export function upsertCaseMemo(caseId: string, memo: Timeline): Timeline[] {
  if (typeof window === "undefined") return [];
  const stored = loadJson<CaseMemosMap>(STORAGE_KEYS.memos, {});
  const list = stored[caseId] ?? [];
  const idx = list.findIndex((m) => m.id === memo.id);
  const next =
    idx >= 0 ? list.map((m, i) => (i === idx ? memo : m)) : [memo, ...list];
  stored[caseId] = next;
  saveJson(STORAGE_KEYS.memos, stored);
  notifyCaseMemoChanged(caseId);
  return next;
}
