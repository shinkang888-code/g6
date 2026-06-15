/**
 * 법원 재판부·기관연락처 메모 포맷
 * 예: 제 3 형사부(나) (전화:031-828-0421 (수요일,금요일은 재판으로 업무처리가 어렵습니다.))
 */

/** ssgo 재판부 셀 원문 → 메모 하단(3행) 연락처 줄 */
export function formatCourtDivisionContactLine(raw?: string | null): string | null {
  const trimmed = (raw ?? "").replace(/\s+/g, " ").trim();
  return trimmed || null;
}
