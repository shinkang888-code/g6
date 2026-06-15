import { buildCaseEditTabUrl } from "@/lib/tabTitle";

export const CASE_EDIT_POPUP_NAME = "case-edit";
export const CASE_EDIT_POPUP_CHANNEL = "lawygo-case-edit-popup";
export const CASE_EDIT_TAB_MESSAGE_TYPE = "LAWYGO_CASE_EDIT_TAB_OPEN";
export const CASE_EDIT_TAB_ACK_TYPE = "LAWYGO_CASE_EDIT_TAB_ACK";
export const CASE_EDIT_TABS_STORAGE_KEY = "lawygo_case_edit_popup_tabs";
export const CASE_EDIT_ACTIVE_TAB_STORAGE_KEY = "lawygo_case_edit_popup_active";
export const CASE_EDITED_MESSAGE_TYPE = "LAWYGO_CASE_EDITED";

export type CaseEditTab = {
  id: string;
  caseId: string;
  caseNumber: string;
};

export type CaseEditTabOpenMessage = {
  type: typeof CASE_EDIT_TAB_MESSAGE_TYPE;
  caseId: string;
  caseNumber: string;
};

declare global {
  interface Window {
    __lawygoCaseEditPopup?: Window | null;
  }
}

export function createCaseEditTab(caseId: string, caseNumber: string): CaseEditTab {
  return { id: `edit-tab-${caseId}`, caseId, caseNumber };
}

export function loadCaseEditTabs(): CaseEditTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CASE_EDIT_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaseEditTab[];
    return Array.isArray(parsed) ? parsed.filter((t) => t?.caseId && t?.caseNumber) : [];
  } catch {
    return [];
  }
}

export function saveCaseEditTabs(tabs: CaseEditTab[], activeId: string | null): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CASE_EDIT_TABS_STORAGE_KEY, JSON.stringify(tabs));
  if (activeId) sessionStorage.setItem(CASE_EDIT_ACTIVE_TAB_STORAGE_KEY, activeId);
  else sessionStorage.removeItem(CASE_EDIT_ACTIVE_TAB_STORAGE_KEY);
}

export function loadActiveCaseEditTabId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CASE_EDIT_ACTIVE_TAB_STORAGE_KEY);
}

export function addOrActivateCaseEditTab(
  tabs: CaseEditTab[],
  caseId: string,
  caseNumber: string
): { tabs: CaseEditTab[]; activeId: string } {
  const existing = tabs.find((t) => t.caseId === caseId);
  if (existing) return { tabs, activeId: existing.id };
  const tab = createCaseEditTab(caseId, caseNumber);
  return { tabs: [...tabs, tab], activeId: tab.id };
}

function getPopupFeatures(): string {
  const w = 1280;
  const h = 860;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  return `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

function openNewCaseEditPopup(caseId: string, caseNumber: string): void {
  const url = `/cases/edit-popup?caseId=${encodeURIComponent(caseId)}&caseNumber=${encodeURIComponent(caseNumber)}`;
  const popup = window.open(url, CASE_EDIT_POPUP_NAME, getPopupFeatures());
  if (popup) window.__lawygoCaseEditPopup = popup;
}

/** 사건 등록(편집) 페이지를 팝업 창 상단 탭으로 열기 */
export function openCaseEditPopup(caseId: string, caseNumber?: string): void {
  if (typeof window === "undefined" || !caseId) return;

  const label = (caseNumber?.trim() || caseId).trim();
  const message: CaseEditTabOpenMessage = {
    type: CASE_EDIT_TAB_MESSAGE_TYPE,
    caseId,
    caseNumber: label,
  };

  const cached = window.__lawygoCaseEditPopup;
  if (cached && !cached.closed) {
    cached.postMessage(message, window.location.origin);
    cached.focus();
    return;
  }

  if (typeof BroadcastChannel === "undefined") {
    openNewCaseEditPopup(caseId, label);
    return;
  }

  const channel = new BroadcastChannel(CASE_EDIT_POPUP_CHANNEL);
  let acked = false;

  const onAck = (event: MessageEvent) => {
    if ((event.data as { type?: string })?.type === CASE_EDIT_TAB_ACK_TYPE) {
      acked = true;
      window.__lawygoCaseEditPopup?.focus();
    }
  };

  channel.addEventListener("message", onAck);
  channel.postMessage(message);

  window.setTimeout(() => {
    channel.removeEventListener("message", onAck);
    channel.close();
    if (!acked) openNewCaseEditPopup(caseId, label);
  }, 120);
}

export function isCaseEditPopupWindow(pathname: string | null): boolean {
  if (typeof window === "undefined" || !pathname) return false;

  if (pathname === "/cases/edit-popup" || pathname.endsWith("/cases/edit-popup")) return true;
  if (window.name === CASE_EDIT_POPUP_NAME) return true;

  if (/^\/cases\/[^/]+\/edit$/.test(pathname)) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("popup") === "1") return true;
    try {
      if (window.parent !== window && window.parent.name === CASE_EDIT_POPUP_NAME) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export function getCaseEditEmbedUrl(caseId: string): string {
  return `/cases/${encodeURIComponent(caseId)}/edit?popup=1`;
}

/** 사건 등록(수정) 페이지를 새 브라우저 탭에서 열기 (탭 제목: 의뢰인명 · 사건수정) */
export function openCaseEditInNewTab(
  caseId: string,
  options?: { clientName?: string; caseNumber?: string }
): void {
  if (typeof window === "undefined" || !caseId) return;
  window.open(buildCaseEditTabUrl(caseId, options), "_blank", "noopener,noreferrer");
}
