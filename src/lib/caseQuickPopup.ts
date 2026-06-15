/**
 * 대시보드·목록 등에서 사건별 기일/메모/자료실을 새 창으로 열기
 */

export type CaseQuickView = "dates" | "memo" | "files";

const VIEW_PATH: Record<CaseQuickView, string> = {
  dates: "/cases/deadline-info",
  memo: "/cases/memo-popup",
  files: "/cases/files-popup",
};

const VIEW_WINDOW: Record<CaseQuickView, string> = {
  dates: "case-deadline-info",
  memo: "case-memo",
  files: "case-files",
};

function popupFeatures(width = 960, height = 720): string {
  const left = Math.max(0, (window.screen.width - width) / 2);
  const top = Math.max(0, (window.screen.height - height) / 2);
  return `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

export function getCaseQuickViewUrl(
  view: CaseQuickView,
  caseId: string,
  caseNumber?: string
): string {
  const params = new URLSearchParams({ caseId });
  if (caseNumber?.trim()) params.set("caseNumber", caseNumber.trim());
  return `${VIEW_PATH[view]}?${params.toString()}`;
}

export function openCaseQuickView(
  caseId: string,
  view: CaseQuickView,
  caseNumber?: string
): void {
  if (typeof window === "undefined" || !caseId) return;
  const url = getCaseQuickViewUrl(view, caseId, caseNumber);
  const w = view === "files" ? 1100 : 920;
  const h = view === "files" ? 780 : 720;
  window.open(url, `${VIEW_WINDOW[view]}-${caseId}`, popupFeatures(w, h));
}
