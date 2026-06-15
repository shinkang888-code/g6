/**
 * 사건메모함 — 기일 변동 시 자동 메모 (좌하단 메모장)
 */

import { courtSyncMemoId, getStoredCaseMemos, upsertCaseMemo } from "./caseScopedStorage";
import {
  buildAutoDeadlineMemoContent,
  resolveDeadlineForMemo,
  type CaseDeadlineMemoCtx,
  type CaseDeadlineRow,
} from "./caseDeadlineMemoCore";
import type { Timeline } from "./types";

export {
  pickNextDeadline,
  buildAutoDeadlineMemoContent,
  resolveDeadlineForMemo,
} from "./caseDeadlineMemoCore";
export type { CaseDeadlineMemoCtx, CaseDeadlineRow } from "./caseDeadlineMemoCore";

function buildAutoDeadlineTimeline(
  caseId: string,
  content: string,
  row: CaseDeadlineRow
): Timeline {
  return {
    id: courtSyncMemoId(caseId),
    caseId,
    type: "memo",
    title: "법원기일연동 — 다음 기일",
    content,
    authorId: "court-sync",
    authorName: "법원기일연동",
    date: `${row.date}T09:00:00Z`,
    metadata: { source: "court_sync", deadlineId: row.id },
  };
}

/** 기존 자동 메모와 내용이 같으면 false */
export function shouldUpdateAutoDeadlineMemo(caseId: string, content: string): boolean {
  const existing = getStoredCaseMemos(caseId).find((m) => m.id === courtSyncMemoId(caseId));
  return existing?.content !== content;
}

/** 내용이 바뀐 경우에만 localStorage 메모 갱신 */
export function upsertAutoDeadlineMemoIfChanged(
  caseId: string,
  content: string,
  row: CaseDeadlineRow
): { memos: Timeline[]; changed: boolean } {
  const list = getStoredCaseMemos(caseId);
  const existing = list.find((m) => m.id === courtSyncMemoId(caseId));
  if (existing?.content === content) {
    return { memos: list.length ? list : getStoredCaseMemos(caseId), changed: false };
  }
  const memos = upsertCaseMemo(caseId, buildAutoDeadlineTimeline(caseId, content, row));
  return { memos, changed: true };
}

/** 서버·연동 응답에서 받은 메모 본문을 바로 반영 */
export function applyDeadlineMemoContent(
  caseId: string,
  content: string,
  row: Pick<CaseDeadlineRow, "date" | "id">
): Timeline[] {
  const fullRow: CaseDeadlineRow = {
    id: row.id ?? "court-sync",
    date: row.date,
  };
  return upsertCaseMemo(caseId, buildAutoDeadlineTimeline(caseId, content, fullRow));
}

async function fetchCaseMemoCtx(caseId: string): Promise<Partial<CaseDeadlineMemoCtx>> {
  try {
    const res = await fetch(`/api/admin/cases?id=${encodeURIComponent(caseId)}`, {
      credentials: "include",
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      data?: Array<{
        caseNumber?: string;
        clientName?: string;
        court?: string;
        courtDivision?: string;
        nextDate?: string;
        nextDateType?: string;
      }>;
    };
    const c = json.data?.[0];
    if (!c) return {};
    return {
      caseNumber: c.caseNumber,
      clientName: c.clientName,
      court: c.court,
      courtDivision: c.courtDivision,
      nextDate: c.nextDate,
      nextDateType: c.nextDateType,
    };
  } catch {
    return {};
  }
}

/**
 * 기일 API + 사건 정보로 자동 메모 생성·갱신
 * - 기일 변동 시에만 내용 업데이트
 * - deadlines 없으면 사건 nextDate 로 대체
 */
export async function applyCourtSyncDeadlineMemo(
  caseId: string,
  ctx?: Partial<CaseDeadlineMemoCtx>
): Promise<{ memos: Timeline[]; changed: boolean } | null> {
  if (typeof window === "undefined") return null;
  try {
    const mergedCtx: CaseDeadlineMemoCtx = {
      caseNumber: ctx?.caseNumber ?? "",
      clientName: ctx?.clientName ?? "",
      court: ctx?.court,
      courtDivision: ctx?.courtDivision,
      nextDate: ctx?.nextDate,
      nextDateType: ctx?.nextDateType,
    };

    if (!mergedCtx.caseNumber || !mergedCtx.clientName) {
      const fromApi = await fetchCaseMemoCtx(caseId);
      Object.assign(mergedCtx, {
        caseNumber: mergedCtx.caseNumber || fromApi.caseNumber || "",
        clientName: mergedCtx.clientName || fromApi.clientName || "",
        court: mergedCtx.court || fromApi.court,
        courtDivision: mergedCtx.courtDivision || fromApi.courtDivision,
        nextDate: mergedCtx.nextDate || fromApi.nextDate,
        nextDateType: mergedCtx.nextDateType || fromApi.nextDateType,
      });
    }

    const res = await fetch(`/api/deadlines?caseId=${encodeURIComponent(caseId)}`, {
      credentials: "include",
    });
    const rows: CaseDeadlineRow[] = res.ok
      ? (((await res.json()) as { data?: CaseDeadlineRow[] }).data ?? [])
      : [];

    const picked = resolveDeadlineForMemo(rows, mergedCtx);
    if (!picked) return null;

    if (!mergedCtx.caseNumber && picked.caseNumber) {
      mergedCtx.caseNumber = picked.caseNumber;
    }

    const content = buildAutoDeadlineMemoContent(picked, mergedCtx);
    return upsertAutoDeadlineMemoIfChanged(caseId, content, picked);
  } catch {
    return null;
  }
}
