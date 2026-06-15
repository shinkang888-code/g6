/** 국가법령정보센터 판례 검색 */
import {
  normalizePrecedentCaseNumber,
  storePrecedentViewerPayload,
  type PrecedentViewerPayload,
} from "./precedentViewerStorage";

export { normalizePrecedentCaseNumber } from "./precedentViewerStorage";

export function buildPrecedentLawGoKrSearchUrl(caseNumber: string): string {
  const q = encodeURIComponent(normalizePrecedentCaseNumber(caseNumber));
  return `https://www.law.go.kr/LSW/precSc.do?menuId=7&subMenuId=47&tabMenuId=213&query=${q}`;
}

export function buildPrecedentScourtSearchUrl(caseNumber: string): string {
  const q = encodeURIComponent(normalizePrecedentCaseNumber(caseNumber));
  return `https://glaw.scourt.go.kr/wsjo/lwjo/wsSearch.do?searchWord=${q}`;
}

export function isValidPrecedentCaseNumber(caseNumber: string): boolean {
  const v = normalizePrecedentCaseNumber(caseNumber);
  if (!v || v.startsWith("AI")) return false;
  return /^\d{4}[가-힣]+\d+/.test(v) || /^[가-힣]+\d+/.test(v);
}

export type PrecedentPopupPayload = Partial<
  Omit<PrecedentViewerPayload, "caseNumber" | "savedAt">
>;

/** 판례 뷰어 팝업 — AI 본문을 sessionStorage에 저장 후 열기 */
export function openPrecedentOriginalPopup(
  caseNumber: string,
  payload?: PrecedentPopupPayload
): Window | null {
  if (typeof window === "undefined" || !isValidPrecedentCaseNumber(caseNumber)) return null;

  const normalized = normalizePrecedentCaseNumber(caseNumber);
  storePrecedentViewerPayload({
    caseNumber: normalized,
    date: payload?.date,
    court: payload?.court,
    issueSummary: payload?.issueSummary,
    matchReason: payload?.matchReason,
    bodySummary: payload?.bodySummary,
    fullText: payload?.fullText,
  });

  const url = `/board/precedent-viewer?caseNumber=${encodeURIComponent(normalized)}`;
  const w = 1180;
  const h = 900;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);

  const popup = window.open(
    url,
    `precedent-viewer-${normalized}`,
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );

  if (!popup) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return popup;
}

/** 국가법령정보센터를 새 탭으로 직접 열기 */
export function openPrecedentExternalTab(caseNumber: string): void {
  if (typeof window === "undefined" || !isValidPrecedentCaseNumber(caseNumber)) return;
  window.open(buildPrecedentLawGoKrSearchUrl(caseNumber), "_blank", "noopener,noreferrer");
}
