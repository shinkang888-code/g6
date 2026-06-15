/**
 * 대법원 나의 사건검색 연동
 * - 조회 보조 팝업(LawyGo): 사건번호·법원·의뢰인 자동 입력
 * - 대법원(ssgo) 사이트: 보안·캡차 정책으로 외부 URL 자동입력 불가 → 클립보드 복사 지원
 * @see docs/scourt-case-search-integration.md
 */

import { parseCaseNumber } from "@/lib/scourtBot";

/** 나의 사건검색 페이지 URL (대법원 포털) */
export const SCOURT_MY_CASE_SEARCH_URL =
  "https://www.scourt.go.kr/portal/information/events/search/search.jsp";

/** ssgo 나의 사건검색 (실제 입력 폼) */
export const SCOURT_SSGO_SEARCH_URL = "https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www";

export type ScourtSearchFields = {
  caseNumber: string;
  court: string;
  partyName: string;
  year: string;
  gubun: string;
  serial: string;
};

export function buildScourtSearchFields(
  caseNumber: string,
  partyName: string,
  court = ""
): ScourtSearchFields {
  const parsed = parseCaseNumber(caseNumber);
  return {
    caseNumber: caseNumber?.trim() ?? "",
    court: court?.trim() ?? "",
    partyName: partyName?.trim() ?? "",
    year: parsed.year ?? "",
    gubun: parsed.gubun ?? "",
    serial: parsed.serial ?? "",
  };
}

/**
 * 법원 포털에 붙여넣기 쉬운 형태 (필드별 줄 구분)
 */
export function getScourtSearchCopyText(
  caseNumber: string,
  partyName: string,
  court = ""
): string {
  const f = buildScourtSearchFields(caseNumber, partyName, court);
  const lines: string[] = [];
  if (f.court) lines.push(`관할법원: ${f.court}`);
  if (f.year) lines.push(`사건년도: ${f.year}`);
  if (f.gubun) lines.push(`사건구분: ${f.gubun}`);
  if (f.serial) lines.push(`사건번호: ${f.serial}`);
  if (f.caseNumber && !f.serial) lines.push(`사건번호: ${f.caseNumber}`);
  if (f.partyName) lines.push(`당사자(의뢰인): ${f.partyName}`);
  return lines.join("\n");
}

/** LawyGo 조회 보조 팝업 — 입력값 자동 채움 */
export function openScourtSearchAssistPopup(
  caseNumber: string,
  partyName: string,
  court = "",
  caseId = "",
  options?: { autoOpenSite?: boolean; embed?: boolean }
): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (caseNumber?.trim()) params.set("caseNumber", caseNumber.trim());
  if (partyName?.trim()) params.set("partyName", partyName.trim());
  if (court?.trim()) params.set("court", court.trim());
  if (caseId?.trim()) params.set("caseId", caseId.trim());
  if (options?.autoOpenSite) params.set("autoOpen", "1");
  if (options?.embed) params.set("embed", "1");
  const url = `/cases/scourt-search?${params.toString()}`;
  const w = 520;
  const h = 780;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  window.open(
    url,
    "scourt-search-assist",
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
}

export type ScourtAssistOpenResult = {
  copied: boolean;
  mode: "popup" | "tab" | "sheet";
};

/** 사건 기준 나의사건검색 연동 (모바일은 동일 탭, 데스크톱은 보조 팝업) */
export async function openScourtAssistForCase(input: {
  caseId: string;
  caseNumber: string;
  partyName: string;
  court: string;
  autoOpenSite?: boolean;
  mobile?: boolean;
}): Promise<ScourtAssistOpenResult> {
  const copied = await copyScourtFieldsToClipboard(
    input.caseNumber,
    input.partyName,
    input.court
  );

  if (typeof window === "undefined") {
    return { copied, mode: "popup" };
  }

  const params = new URLSearchParams();
  params.set("caseId", input.caseId);
  params.set("caseNumber", input.caseNumber.trim());
  params.set("partyName", input.partyName.trim());
  params.set("court", input.court.trim());
  if (input.autoOpenSite) params.set("autoOpen", "1");

  const url = `/cases/scourt-search?${params.toString()}`;

  if (input.mobile) {
    params.set("returnTo", "/cases");
    window.location.assign(`/cases/scourt-search?${params.toString()}`);
    return { copied, mode: "tab" };
  }

  openScourtSearchAssistPopup(
    input.caseNumber,
    input.partyName,
    input.court,
    input.caseId,
    { autoOpenSite: input.autoOpenSite }
  );
  return { copied, mode: "popup" };
}

export function openScourtMyCaseSearch(): void {
  if (typeof window !== "undefined") {
    window.open(SCOURT_SSGO_SEARCH_URL, "_blank", "noopener,noreferrer");
  }
}

/**
 * 1) LawyGo 조회 보조 팝업(자동 입력)
 * 2) 클립보드에 법원·사건번호·의뢰인 복사
 * 3) 대법원 ssgo 새 탭
 *
 * 대법원 사이트 자체에는 브라우저 보안상 직접 자동입력 불가 — 붙여넣기용 복사 제공
 */
export async function copyScourtFieldsToClipboard(
  caseNumber: string,
  partyName: string,
  court = ""
): Promise<boolean> {
  const text = getScourtSearchCopyText(caseNumber, partyName, court);
  if (!text || typeof navigator?.clipboard?.writeText !== "function") return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 조회 보조 팝업 + 클립보드 (ssgo 는 보조창에서 [나의 사건검색에서 연동]으로 열기) */
export async function copyAndOpenScourtSearch(
  caseNumber: string,
  partyName: string,
  court = "",
  caseId = ""
): Promise<{ copied: boolean }> {
  const copied = await copyScourtFieldsToClipboard(caseNumber, partyName, court);
  openScourtSearchAssistPopup(caseNumber, partyName, court, caseId);
  return { copied };
}

/** 조회 보조창 내부: 클립보드 + ssgo만 (중첩 팝업 방지) */
export async function copyAndOpenScourtSiteOnly(
  caseNumber: string,
  partyName: string,
  court = ""
): Promise<{ copied: boolean }> {
  const copied = await copyScourtFieldsToClipboard(caseNumber, partyName, court);
  openScourtMyCaseSearch();
  return { copied };
}
