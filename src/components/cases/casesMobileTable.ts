/**
 * 사건 목록 테이블 — 모바일(max-lg) 열 너비·숨김 설정
 * columns 배열 순서와 MOBILE_COL_WIDTHS 키 순서가 반드시 일치해야 함
 */

import type { CaseItem } from "@/lib/types";

export type CaseListColumnKey = keyof CaseItem | "sync";

/** page.tsx columns 배열과 동일 순서 */
export const CASE_TABLE_COLUMN_KEYS = [
  "caseNumber",
  "caseType",
  "caseName",
  "court",
  "clientName",
  "clientPosition",
  "assignedStaff",
  "assistants",
  "registeredDate",
  "createdByName",
  "receivedDate",
  "nextDate",
  "status",
] as const satisfies readonly (keyof CaseItem)[];

/** 모바일 가로 스크롤 최소 폭 (8개 필드 + 체크박스) */
export const MOBILE_TABLE_MIN_WIDTH = 700;

export const DESKTOP_TABLE_MIN_WIDTH = 1360;

export const DESKTOP_COL_WIDTHS: Record<string, string> = {
  checkbox: "40px",
  caseNumber: "128px",
  caseType: "52px",
  caseName: "220px",
  court: "120px",
  clientName: "88px",
  clientPosition: "56px",
  assignedStaff: "72px",
  assistants: "100px",
  registeredDate: "88px",
  createdByName: "72px",
  receivedDate: "88px",
  nextDate: "100px",
  status: "72px",
  sync: "80px",
};

/**
 * 모바일에서 숨기는 열
 * 표시: 사건번호·사건명·기관·의뢰인·수임일·담당·기일·상태
 * caseType은 사건번호 셀에 뱃지로 합침
 */
export const MOBILE_HIDDEN_COLUMN_KEYS = new Set<CaseListColumnKey>([
  "caseType",
  "clientPosition",
  "assistants",
  "registeredDate",
  "createdByName",
  "sync",
]);

/** checkbox + CASE_TABLE_COLUMN_KEYS + sync 순서의 모바일 col 너비 */
export const MOBILE_COL_WIDTHS: Record<string, string> = {
  checkbox: "28px",
  caseNumber: "84px",
  caseType: "0",
  caseName: "150px",
  court: "80px",
  clientName: "64px",
  clientPosition: "0",
  assignedStaff: "60px",
  assistants: "0",
  registeredDate: "0",
  createdByName: "0",
  receivedDate: "52px",
  nextDate: "76px",
  status: "56px",
  sync: "0",
};

/** 모바일 표시 열 고정 폭 (table-fixed 겹침 방지) */
export const MOBILE_VISIBLE_CELL_CLASS: Partial<Record<CaseListColumnKey | "checkbox", string>> = {
  checkbox: "max-lg:min-w-[28px] max-lg:w-[28px]",
  caseNumber: "max-lg:min-w-[84px] max-lg:w-[84px]",
  caseName: "max-lg:min-w-[150px] max-lg:w-[150px]",
  court: "max-lg:min-w-[80px] max-lg:w-[80px]",
  clientName: "max-lg:min-w-[64px] max-lg:w-[64px]",
  receivedDate: "max-lg:min-w-[52px] max-lg:w-[52px]",
  assignedStaff: "max-lg:min-w-[60px] max-lg:w-[60px]",
  nextDate: "max-lg:min-w-[76px] max-lg:w-[76px]",
  status: "max-lg:min-w-[56px] max-lg:w-[56px]",
};

export function isMobileHiddenColumn(key: CaseListColumnKey): boolean {
  return MOBILE_HIDDEN_COLUMN_KEYS.has(key);
}

export function mobileColWidth(key: string): string {
  return MOBILE_COL_WIDTHS[key] ?? "0";
}

export function isMobileHiddenColWidth(key: string): boolean {
  return mobileColWidth(key) === "0";
}

export function mobileVisibleCellClass(key: CaseListColumnKey | "checkbox"): string {
  if (key !== "checkbox" && isMobileHiddenColumn(key)) return "";
  return MOBILE_VISIBLE_CELL_CLASS[key] ?? "";
}

/** 모바일 헤더 라벨 (짧은 표기) */
export function mobileColumnLabel(key: CaseListColumnKey, defaultLabel: string): string {
  if (key === "nextDate") return "기일";
  if (key === "receivedDate") return "수임일";
  return defaultLabel;
}

/** 데스크톱 전용 min-width (모바일 minWidth 충돌 방지) */
export function columnMinWidthClass(key: CaseListColumnKey): string | undefined {
  const map: Partial<Record<CaseListColumnKey, string>> = {
    caseNumber: "lg:min-w-[128px]",
    caseType: "lg:min-w-[52px]",
    court: "lg:min-w-[120px]",
    clientName: "lg:min-w-[80px]",
    clientPosition: "lg:min-w-[56px]",
    assignedStaff: "lg:min-w-[64px]",
    assistants: "lg:min-w-[88px]",
    registeredDate: "lg:min-w-[84px]",
    createdByName: "lg:min-w-[64px]",
    receivedDate: "lg:min-w-[84px]",
    nextDate: "lg:min-w-[96px]",
    status: "lg:min-w-[64px]",
    sync: "lg:min-w-[72px]",
  };
  return map[key];
}

export const MOBILE_TH_CLASS =
  "max-lg:px-0.5 max-lg:py-1 max-lg:text-[10px] max-lg:font-semibold max-lg:tracking-normal max-lg:normal-case max-lg:whitespace-nowrap";

export const MOBILE_TD_CLASS = "max-lg:px-0.5 max-lg:py-1 max-lg:align-middle max-lg:whitespace-nowrap max-lg:overflow-hidden";

/** colgroup·columns 배열 정합성 검사 (스크립트·테스트용) */
export function assertMobileTableColumnAlignment(columnKeys: readonly string[]): string[] {
  const errors: string[] = [];
  if (columnKeys.length !== CASE_TABLE_COLUMN_KEYS.length) {
    errors.push(
      `columns 길이 불일치: page=${columnKeys.length} expected=${CASE_TABLE_COLUMN_KEYS.length}`
    );
  }
  CASE_TABLE_COLUMN_KEYS.forEach((key, i) => {
    if (columnKeys[i] !== key) {
      errors.push(`columns[${i}]=${columnKeys[i] ?? "?"} expected=${key}`);
    }
  });
  const colgroupKeys = ["checkbox", ...CASE_TABLE_COLUMN_KEYS, "sync"];
  for (const key of colgroupKeys) {
    if (!(key in MOBILE_COL_WIDTHS)) {
      errors.push(`MOBILE_COL_WIDTHS에 '${key}' 없음`);
    }
  }

  const requiredVisible = [
    "caseNumber",
    "caseName",
    "court",
    "clientName",
    "receivedDate",
    "assignedStaff",
    "nextDate",
    "status",
  ] as const;
  for (const key of requiredVisible) {
    if (MOBILE_HIDDEN_COLUMN_KEYS.has(key)) {
      errors.push(`모바일 필수 열 '${key}' 이 숨김 처리됨`);
    }
    if (isMobileHiddenColWidth(key)) {
      errors.push(`모바일 필수 열 '${key}' col 폭이 0`);
    }
  }

  const hiddenOnMobile = ["assistants", "caseType", "clientPosition"] as const;
  for (const key of hiddenOnMobile) {
    if (!MOBILE_HIDDEN_COLUMN_KEYS.has(key)) {
      errors.push(`모바일에서 숨겨야 할 열 '${key}' 이 표시됨`);
    }
  }

  return errors;
}
