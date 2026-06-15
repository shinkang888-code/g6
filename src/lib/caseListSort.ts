/**
 * 사건 목록 — 다음 기일 임박순 정렬 (LawTop 스타일)
 * 1) 오늘·미래 기일 — D-Day 오름차순 (가장 가까운 기일 최상단)
 * 2) 과거 기일만 있는 사건 — 최근 과거 순
 * 3) 기일 없음(미정) — 맨 아래
 */

import { getDDay } from "./utils";

export type CaseNextDateSortable = {
  nextDate?: string | null;
  createdAt?: string;
  caseNumber?: string;
};

/** 정렬 티어: 0=미래, 1=과거, 2=미정 */
function nextDateRank(date: string | null | undefined): [tier: number, key: number] {
  if (!date?.trim()) return [2, Number.MAX_SAFE_INTEGER];
  const dday = getDDay(date);
  if (dday >= 0) return [0, dday];
  return [1, -dday];
}

export function compareByNextDeadline(
  a: CaseNextDateSortable,
  b: CaseNextDateSortable
): number {
  const [ta, ka] = nextDateRank(a.nextDate);
  const [tb, kb] = nextDateRank(b.nextDate);
  if (ta !== tb) return ta - tb;
  if (ka !== kb) return ka - kb;
  const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (ac !== bc) return bc - ac;
  return String(a.caseNumber ?? "").localeCompare(String(b.caseNumber ?? ""), "ko");
}

export function sortCasesByNextDeadline<T extends CaseNextDateSortable>(rows: T[]): T[] {
  return [...rows].sort(compareByNextDeadline);
}
