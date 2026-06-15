/**
 * 기일 자동 메모 — 서버·클라이언트 공용 (브라우저 API 미사용)
 */

import {
  formatCourtDeadlineSummary,
  parsePlaceFromDeadlineMemo,
  parseTimeFromDeadlineMemo,
  type CourtDeadlineSummaryCtx,
  type DeadlineRow,
} from "./deadlineDisplay";
import { getDDay } from "./utils";

const COURT_SYNC_MARKER = "[court_sync]";

/** 동일 날짜 중 법원연동·호실 정보가 있는 행을 우선 */
export function scoreDeadlineRow(row: Pick<CaseDeadlineRow, "memo">): number {
  let score = 0;
  if (row.memo?.includes(COURT_SYNC_MARKER)) score += 100;
  if (parsePlaceFromDeadlineMemo(row.memo)) score += 50;
  if (parseTimeFromDeadlineMemo(row.memo) !== "미정") score += 10;
  return score;
}

export type CaseDeadlineRow = {
  id: string;
  date: string;
  type?: string;
  court?: string;
  memo?: string;
  caseNumber?: string;
};

export type CaseDeadlineMemoCtx = CourtDeadlineSummaryCtx & {
  nextDate?: string;
  nextDateType?: string;
};

function compareDeadlineRows(a: CaseDeadlineRow, b: CaseDeadlineRow): number {
  const dateCmp = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (dateCmp !== 0) return dateCmp;
  return scoreDeadlineRow(b) - scoreDeadlineRow(a);
}

/** 오늘 이후 가장 가까운 기일, 없으면 가장 최근 기일 (동일 날짜는 court_sync·호실 우선) */
export function pickNextDeadline(rows: CaseDeadlineRow[]): CaseDeadlineRow | null {
  const withDate = rows.filter((r) => r.date);
  if (!withDate.length) return null;

  const future = withDate.filter((r) => getDDay(r.date) >= 0);
  if (future.length) {
    return [...future].sort(compareDeadlineRows)[0];
  }

  return [...withDate].sort((a, b) => {
    const dateCmp = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCmp !== 0) return dateCmp;
    return scoreDeadlineRow(b) - scoreDeadlineRow(a);
  })[0];
}

/** API 기일 없을 때 사건 요약 필드로 대체 */
export function deadlineRowFromCaseCtx(ctx: CaseDeadlineMemoCtx): CaseDeadlineRow | null {
  if (!ctx.nextDate?.trim()) return null;
  return {
    id: "case-next",
    date: ctx.nextDate.trim(),
    type: ctx.nextDateType?.trim() || "기일",
    court: ctx.court,
    memo: undefined,
  };
}

export function resolveDeadlineForMemo(
  rows: CaseDeadlineRow[],
  ctx: CaseDeadlineMemoCtx
): CaseDeadlineRow | null {
  return pickNextDeadline(rows) ?? deadlineRowFromCaseCtx(ctx);
}

export function buildAutoDeadlineMemoContent(
  row: CaseDeadlineRow,
  ctx: CaseDeadlineMemoCtx
): string {
  const summaryCtx: CourtDeadlineSummaryCtx = {
    caseNumber: ctx.caseNumber?.trim() || row.caseNumber?.trim() || "",
    clientName: ctx.clientName?.trim() || "",
    court: ctx.court?.trim() || row.court,
    courtDivision: ctx.courtDivision?.trim() || undefined,
  };
  return formatCourtDeadlineSummary(
    {
      id: row.id,
      date: row.date,
      type: row.type,
      court: row.court,
      memo: row.memo,
    } satisfies DeadlineRow,
    summaryCtx
  );
}
