/** 브라우저 탭 제목 공통 유틸 */

import { useEffect } from "react";

export const DEFAULT_TAB_TITLE = "LawyGo - 법무 관리 시스템";

/** 예: "전준범 · 사건수정", "상담관리" */
export function formatTaskTabTitle(task: string, context?: string): string {
  const ctx = context?.trim();
  return ctx ? `${ctx} · ${task}` : task;
}

export function setDocumentTabTitle(title: string): void {
  if (typeof document === "undefined") return;
  document.title = title;
}

export function buildCaseEditTabUrl(caseId: string, options?: { clientName?: string; caseNumber?: string }): string {
  const params = new URLSearchParams();
  const label = options?.clientName?.trim() || options?.caseNumber?.trim();
  if (label) params.set("tab", label);
  const qs = params.toString();
  return `/cases/${encodeURIComponent(caseId)}/edit${qs ? `?${qs}` : ""}`;
}

/** 페이지 마운트 시 탭 제목 설정 (상담관리, 기일관리 등) */
export function usePageTabTitle(title: string): void {
  useEffect(() => {
    setDocumentTabTitle(title);
    return () => setDocumentTabTitle(DEFAULT_TAB_TITLE);
  }, [title]);
}
