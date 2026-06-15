/**
 * 사건 목록 진행상태 필터
 */

export const CASE_STATUS_FILTER_OPTIONS = [
  "진행중",
  "종결",
  "전체 (진행+종결)",
  "사임",
] as const;

export type CaseStatusFilterOption = (typeof CASE_STATUS_FILTER_OPTIONS)[number];

export const CASE_STATUS_FILTER_ALL_LABEL = "전체 (진행+종결)" as const;

/** API 쿼리 status 파라미터 (전체 = 진행중+종결) */
export function caseStatusFilterToApiParam(value: string): string | null {
  if (value === CASE_STATUS_FILTER_ALL_LABEL) return "진행중,종결";
  if (value === "진행중" || value === "종결" || value === "사임") return value;
  return null;
}

/** API status 파라미터 → Supabase 필터용 상태 목록 */
export function parseCaseStatusApiParam(status: string): string[] | null {
  const s = status.trim();
  if (!s) return null;
  if (s === "진행중,종결") return ["진행중", "종결"];
  if (s === "진행중" || s === "종결" || s === "사임") return [s];
  return null;
}
