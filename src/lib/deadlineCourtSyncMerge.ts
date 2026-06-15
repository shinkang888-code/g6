/**
 * 법원기일연동 — 기일 차분(델타) 반영
 * 전체 삭제 후 재삽입 대신 변경분만 insert/update/delete
 */
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScourtEvent } from "@/lib/scourtBot";

export const COURT_SYNC_TAG = "[court_sync]";
/** memo 스키마 변경 시 올려 기존 연동 건 재반영 (v3: 재판부·기관연락처 메모 3행) */
const COURT_SYNC_MEMO_VERSION = "v3";

export type CourtSyncDeadlineRow = {
  case_id: string;
  deadline_date: string;
  deadline_type: string;
  court: string | null;
  memo: string | null;
  management_number?: string | null;
};

export type MergeCourtSyncResult = {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  changed: boolean;
};

function normalizeDate(s: string): string {
  const m = s.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

/** 기일 고유키: 날짜 + 종류 */
export function deadlineFingerprint(date: string, type: string): string {
  return `${date}|${(type || "기일").trim()}`;
}

export function isCourtSyncMemo(memo?: string | null): boolean {
  return Boolean(memo?.includes(COURT_SYNC_TAG));
}

/** memo 본문: 시각 / 기일장소(호실) / 결과 */
export function buildCourtSyncMemo(
  date: string,
  type: string,
  time?: string,
  place?: string,
  result?: string
): string {
  const body = [time, place, result].filter(Boolean).join(" / ");
  const head = `${COURT_SYNC_TAG}${deadlineFingerprint(date, type)}`;
  return body ? `${head} ${body}` : head;
}

export function fingerprintFromMemo(memo?: string | null): string | null {
  if (!memo?.includes(COURT_SYNC_TAG)) return null;
  const m = memo.match(/\[court_sync\]([^\s]+)/);
  return m?.[1] ?? null;
}

/** 법원 이벤트 목록 → DB 행 + 변경 여부 판별용 해시 */
export function buildIncomingCourtSyncRows(
  caseId: string,
  court: string,
  events: ScourtEvent[]
): CourtSyncDeadlineRow[] {
  return (events ?? [])
    .filter((e) => e.date)
    .map((e) => {
      const deadline_date = normalizeDate(e.date!);
      const deadline_type = (e.type ?? "기일").slice(0, 200);
      return {
        case_id: caseId,
        deadline_date,
        deadline_type,
        court: court || null,
        memo: buildCourtSyncMemo(
          deadline_date,
          deadline_type,
          e.time,
          e.place?.trim() || e.detail?.trim(),
          e.result
        ).slice(0, 2000),
      };
    })
    .filter((r) => r.deadline_date);
}

export function computeCourtEventsHash(rows: CourtSyncDeadlineRow[]): string {
  const canonical = [
    COURT_SYNC_MEMO_VERSION,
    ...rows
      .map(
        (r) =>
          `${r.deadline_date}|${r.deadline_type}|${r.court ?? ""}|${r.memo ?? ""}`
      )
      .sort(),
  ].join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

function rowChanged(
  existing: {
    court: string | null;
    memo: string | null;
    deadline_type: string;
    management_number?: string | null;
  },
  incoming: CourtSyncDeadlineRow,
  managementNumber: string | null
): boolean {
  const needsMgmt =
    Boolean(managementNumber) &&
    (existing.management_number ?? "").trim() !== managementNumber;
  return (
    needsMgmt ||
    (existing.court ?? "") !== (incoming.court ?? "") ||
    (existing.memo ?? "") !== (incoming.memo ?? "") ||
    existing.deadline_type !== incoming.deadline_type
  );
}

/** 법원연동 기일만 차분 반영 (수동/엑셀 기일은 유지) */
export async function mergeCourtSyncDeadlines(
  db: SupabaseClient,
  caseId: string,
  incoming: CourtSyncDeadlineRow[]
): Promise<MergeCourtSyncResult> {
  const { data: caseRow } = await db
    .from("cases")
    .select("management_number")
    .eq("id", caseId)
    .maybeSingle();
  const managementNumber =
    (caseRow?.management_number as string | undefined)?.trim() || null;

  const { data: existing, error: loadErr } = await db
    .from("deadlines")
    .select("id, deadline_date, deadline_type, court, memo, management_number")
    .eq("case_id", caseId);

  if (loadErr) throw new Error(loadErr.message);

  const courtSyncRows = (existing ?? []).filter((r) =>
    isCourtSyncMemo(r.memo as string)
  );

  const byFp = new Map<string, (typeof courtSyncRows)[0]>();
  for (const r of courtSyncRows) {
    const fp =
      fingerprintFromMemo(r.memo as string) ??
      deadlineFingerprint(r.deadline_date as string, r.deadline_type as string);
    byFp.set(fp, r);
  }

  const incomingFps = new Set<string>();
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const row of incoming) {
    const fp = fingerprintFromMemo(row.memo) ?? deadlineFingerprint(row.deadline_date, row.deadline_type);
    incomingFps.add(fp);
    const ex = byFp.get(fp);

    if (!ex) {
      const insertRow = {
        ...row,
        ...(managementNumber ? { management_number: managementNumber } : {}),
      };
      const { error } = await db.from("deadlines").insert(insertRow);
      if (error) throw new Error(error.message);
      added += 1;
    } else if (rowChanged(ex, row, managementNumber)) {
      const { error } = await db
        .from("deadlines")
        .update({
          court: row.court,
          memo: row.memo,
          deadline_type: row.deadline_type,
          ...(managementNumber ? { management_number: managementNumber } : {}),
        })
        .eq("id", ex.id);
      if (error) throw new Error(error.message);
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  let removed = 0;
  for (const [fp, ex] of byFp) {
    if (!incomingFps.has(fp)) {
      const { error } = await db.from("deadlines").delete().eq("id", ex.id);
      if (error) throw new Error(error.message);
      removed += 1;
    }
  }

  const deduped = await removeManualDuplicateDeadlines(db, caseId, incoming);

  return {
    added,
    updated,
    unchanged,
    removed: removed + deduped,
    changed: added + updated + removed + deduped > 0,
  };
}

/** 동일 날짜·종류의 엑셀/수동 기일은 법원연동 행이 있으면 제거 */
async function removeManualDuplicateDeadlines(
  db: SupabaseClient,
  caseId: string,
  incoming: CourtSyncDeadlineRow[]
): Promise<number> {
  if (!incoming.length) return 0;

  const keys = new Set(
    incoming.map((r) => `${r.deadline_date}|${(r.deadline_type || "기일").trim()}`)
  );
  const { data: manualRows, error } = await db
    .from("deadlines")
    .select("id, deadline_date, deadline_type, memo")
    .eq("case_id", caseId);

  if (error || !manualRows?.length) return 0;

  let removed = 0;
  for (const row of manualRows) {
    if (isCourtSyncMemo(row.memo as string)) continue;
    const key = `${row.deadline_date as string}|${((row.deadline_type as string) || "기일").trim()}`;
    if (!keys.has(key)) continue;
    const { error: delErr } = await db.from("deadlines").delete().eq("id", row.id);
    if (!delErr) removed += 1;
  }
  return removed;
}
