/** 판례 뷰어 팝업 — sessionStorage로 AI 본문 전달 */

export type PrecedentViewerPayload = {
  caseNumber: string;
  date?: string;
  court?: string;
  issueSummary?: string;
  matchReason?: string;
  bodySummary?: string;
  fullText?: string;
  savedAt: number;
};

const KEY_PREFIX = "lawygo_precedent_viewer:";

export function precedentViewerStorageKey(caseNumber: string): string {
  return KEY_PREFIX + normalizePrecedentCaseNumber(caseNumber);
}

export function normalizePrecedentCaseNumber(raw: string): string {
  return raw
    .trim()
    .replace(/^[\[(（]+|[\])）.]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\d가-힣]/g, "");
}

export function storePrecedentViewerPayload(payload: Omit<PrecedentViewerPayload, "savedAt">): void {
  if (typeof window === "undefined") return;
  const key = precedentViewerStorageKey(payload.caseNumber);
  const data: PrecedentViewerPayload = { ...payload, savedAt: Date.now() };
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota — ignore */
  }
}

export function readPrecedentViewerPayload(caseNumber: string): PrecedentViewerPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(precedentViewerStorageKey(caseNumber));
    if (!raw) return null;
    return JSON.parse(raw) as PrecedentViewerPayload;
  } catch {
    return null;
  }
}
