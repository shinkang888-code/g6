/**
 * 사건별 기관(법원·검찰·경찰 등) 직접 입력값 - localStorage 저장
 * 목록/상세에서 동일 키로 로드해 표시·필터·정렬에 반영
 */
export const COURT_OVERRIDES_KEY = "lawygo_case_court_overrides";

export function loadCourtOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COURT_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCourtOverrides(data: Record<string, string>): void {
  try {
    localStorage.setItem(COURT_OVERRIDES_KEY, JSON.stringify(data));
  } catch {}
}
