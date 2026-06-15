/**
 * 사건 목록 API 텍스트 검색 필터
 */

/** PostgREST or() 구문용 — 쉼표·와일드카드 제거 */
export function sanitizeCaseSearchTerm(raw: string): string {
  return raw.trim().replace(/,/g, " ").replace(/%/g, "").replace(/_/g, " ");
}

/** 사건번호·숫자 패턴이 있으면 통합 검색, 아니면 인명(의뢰인·담당·보조) 검색 */
export function isCasePersonNameSearchTerm(term: string): boolean {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return false;
  return !/\d/.test(t);
}

/** 의뢰인·담당·보조 인명 검색 */
export function buildCasePersonNameSearchOrFilter(term: string): string | null {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return null;
  const pattern = `%${t}%`;
  const fields = ["client_name", "assigned_staff_name", "assistants"];
  return fields.map((col) => `${col}.ilike.${pattern}`).join(",");
}

/** 통합 검색(q): 의뢰인·담당·보조·사건번호·사건명 등 */
export function buildCaseTextSearchOrFilter(term: string): string | null {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return null;
  const pattern = `%${t}%`;
  const fields = [
    "client_name",
    "case_number",
    "case_name",
    "assigned_staff_name",
    "assistants",
    "opponent_name",
    "created_by_name",
  ];
  return fields.map((col) => `${col}.ilike.${pattern}`).join(",");
}

/** q 파라미터용 — 인명 입력 시 의뢰인·담당·보조만, 사건번호 등은 통합 검색 */
export function buildCaseSearchOrFilter(term: string): string | null {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return null;
  if (isCasePersonNameSearchTerm(t)) {
    return buildCasePersonNameSearchOrFilter(t);
  }
  return buildCaseTextSearchOrFilter(t);
}

/** 담당·보조 전용 검색(staff_q) — q와 중복 시 staff_q는 생략 가능 */
export function buildCaseStaffSearchOrFilter(term: string): string | null {
  const t = sanitizeCaseSearchTerm(term);
  if (!t) return null;
  const pattern = `%${t}%`;
  return `assigned_staff_name.ilike.${pattern},assistants.ilike.${pattern}`;
}
