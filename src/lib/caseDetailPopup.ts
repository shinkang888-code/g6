export const CASE_DETAIL_POPUP_NAME = "case-detail";
export const CASE_POPUP_CHANNEL = "lawygo-case-popup";
export const CASE_TAB_MESSAGE_TYPE = "LAWYGO_CASE_TAB_OPEN";
export const CASE_TAB_ACK_TYPE = "LAWYGO_CASE_TAB_ACK";
export const CASE_TABS_STORAGE_KEY = "lawygo_case_popup_tabs";
export const CASE_ACTIVE_TAB_STORAGE_KEY = "lawygo_case_popup_active";

export type CaseDetailTab = {
  id: string;
  caseId: string;
  caseNumber: string;
};

export type CaseTabOpenMessage = {
  type: typeof CASE_TAB_MESSAGE_TYPE;
  caseId: string;
  caseNumber: string;
};

declare global {
  interface Window {
    __lawygoCaseDetailPopup?: Window | null;
  }
}

export function createCaseDetailTab(caseId: string, caseNumber: string): CaseDetailTab {
  return { id: `tab-${caseId}`, caseId, caseNumber };
}

export function loadCaseDetailTabs(): CaseDetailTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CASE_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaseDetailTab[];
    return Array.isArray(parsed) ? parsed.filter((t) => t?.caseId && t?.caseNumber) : [];
  } catch {
    return [];
  }
}

export function saveCaseDetailTabs(tabs: CaseDetailTab[], activeId: string | null): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CASE_TABS_STORAGE_KEY, JSON.stringify(tabs));
  if (activeId) sessionStorage.setItem(CASE_ACTIVE_TAB_STORAGE_KEY, activeId);
  else sessionStorage.removeItem(CASE_ACTIVE_TAB_STORAGE_KEY);
}

export function loadActiveCaseDetailTabId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CASE_ACTIVE_TAB_STORAGE_KEY);
}

export function addOrActivateCaseDetailTab(
  tabs: CaseDetailTab[],
  caseId: string,
  caseNumber: string
): { tabs: CaseDetailTab[]; activeId: string } {
  const existing = tabs.find((t) => t.caseId === caseId);
  if (existing) return { tabs, activeId: existing.id };
  const tab = createCaseDetailTab(caseId, caseNumber);
  return { tabs: [...tabs, tab], activeId: tab.id };
}

function getPopupFeatures(): string {
  const w = 1280;
  const h = 860;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  return `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

function openNewCaseDetailPopup(caseId: string, caseNumber: string): void {
  const url = `/cases/popup?caseId=${encodeURIComponent(caseId)}&caseNumber=${encodeURIComponent(caseNumber)}`;
  const popup = window.open(url, CASE_DETAIL_POPUP_NAME, getPopupFeatures());
  if (popup) window.__lawygoCaseDetailPopup = popup;
}

/**
 * 사건 상세를 팝업 창(상단 탭)으로 열기
 */
export function openCaseDetailPopup(caseId: string, caseNumber?: string): void {
  if (typeof window === "undefined" || !caseId) return;

  const label = (caseNumber?.trim() || caseId).trim();
  const message: CaseTabOpenMessage = {
    type: CASE_TAB_MESSAGE_TYPE,
    caseId,
    caseNumber: label,
  };

  const cached = window.__lawygoCaseDetailPopup;
  if (cached && !cached.closed) {
    cached.postMessage(message, window.location.origin);
    cached.focus();
    return;
  }

  if (typeof BroadcastChannel === "undefined") {
    openNewCaseDetailPopup(caseId, label);
    return;
  }

  const channel = new BroadcastChannel(CASE_POPUP_CHANNEL);
  let acked = false;

  const onAck = (event: MessageEvent) => {
    if ((event.data as { type?: string })?.type === CASE_TAB_ACK_TYPE) {
      acked = true;
      window.__lawygoCaseDetailPopup?.focus();
    }
  };

  channel.addEventListener("message", onAck);
  channel.postMessage(message);

  window.setTimeout(() => {
    channel.removeEventListener("message", onAck);
    channel.close();
    if (!acked) openNewCaseDetailPopup(caseId, label);
  }, 120);
}

/** 팝업 창에서 사이드바 없이 상세만 표시할지 */
export function isCaseDetailPopupWindow(pathname: string | null): boolean {
  if (typeof window === "undefined" || !pathname) return false;

  if (pathname === "/cases/popup" || pathname.endsWith("/cases/popup")) return true;
  if (window.name === CASE_DETAIL_POPUP_NAME) return true;

  if (/^\/cases\/[^/]+$/.test(pathname)) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("popup") === "1") return true;
    try {
      if (window.parent !== window && window.parent.name === CASE_DETAIL_POPUP_NAME) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export function getCaseDetailEmbedUrl(caseId: string): string {
  return `/cases/${encodeURIComponent(caseId)}?popup=1`;
}
