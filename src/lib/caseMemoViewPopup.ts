export const CASE_MEMO_VIEW_POPUP_NAME = "case-memo-view";

function popupFeatures(width = 560, height = 480): string {
  const left = Math.max(0, (window.screen.width - width) / 2);
  const top = Math.max(0, (window.screen.height - height) / 2);
  return `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

export function getCaseMemoViewPopupUrl(
  caseId: string,
  memoId: string,
  caseNumber?: string
): string {
  const params = new URLSearchParams({ caseId, memoId });
  if (caseNumber?.trim()) params.set("caseNumber", caseNumber.trim());
  return `/cases/memo-view-popup?${params.toString()}`;
}

/** 좌측 메모 목록에서 선택한 메모 전체 내용을 새 창으로 표시 */
export function openCaseMemoViewPopup(
  caseId: string,
  memoId: string,
  caseNumber?: string
): void {
  if (typeof window === "undefined" || !caseId || !memoId) return;
  const url = getCaseMemoViewPopupUrl(caseId, memoId, caseNumber);
  window.open(url, `${CASE_MEMO_VIEW_POPUP_NAME}-${memoId}`, popupFeatures());
}
