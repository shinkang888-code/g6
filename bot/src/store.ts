/**
 * 결과 저장 (선택)
 * LawTop 의 DBAgent.dll(SQL Server) → Supabase(Postgres) 대응.
 *
 * 환경변수 미설정 시 저장을 건너뛰고 콘솔/파일 출력만 합니다.
 * cases 테이블 스키마: supabase/migrations/20260306000000_lawgo_schema.sql
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { updateCaseSyncMeta } from "./courtSyncMeta.js";
import {
  buildIncomingCourtSyncRows,
  computeCourtEventsHash,
  mergeCourtSyncDeadlines,
} from "./deadlineCourtSyncMerge.js";
import type { CaseBasicData } from "./types.js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!config.supabase.enabled) return null;
  if (!client) client = createClient(config.supabase.url, config.supabase.serviceKey);
  return client;
}

/**
 * 조회 결과를 cases 테이블에 upsert + timeline 에 "법원 조회 결과" 기록.
 * matchCaseId 가 있으면 해당 사건을 갱신, 없으면 case_number 로 매칭.
 */
export async function saveCaseResult(d: CaseBasicData): Promise<{ saved: boolean; reason?: string }> {
  const db = getClient();
  if (!db) return { saved: false, reason: "Supabase 미설정(저장 생략)" };

  // 1) 사건 본문 갱신 (court_update). 존재하지 않으면 timeline 기록만.
  const update: Record<string, unknown> = {};
  if (d.caseName) update.case_name = d.caseName;
  if (d.court) update.court = d.court;
  if (d.court_division?.trim()) update.court_division = d.court_division.trim();
  if (d.receivedDate) update.received_date = normalizeDate(d.receivedDate);
  if (d.finalResult) {
    update.status = "종결";
    update.closed_type = d.finalResult;
  }

  let caseRowId = d.matchCaseId ?? null;

  if (caseRowId) {
    await db.from("cases").update(update).eq("id", caseRowId);
  } else {
    const { data: existing } = await db
      .from("cases")
      .select("id")
      .eq("case_number", d.caseNumber)
      .maybeSingle();
    caseRowId = (existing as { id?: string } | null)?.id ?? null;
    if (caseRowId && Object.keys(update).length) {
      await db.from("cases").update(update).eq("id", caseRowId);
    }
  }

  if (!caseRowId) {
    return { saved: false, reason: "매칭 사건 없음(timeline 미기록)" };
  }

  const incoming = buildIncomingCourtSyncRows(caseRowId, d.court ?? "", d.events ?? []);
  const eventsHash = computeCourtEventsHash(incoming);

  const { data: metaRow } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "court_deadline_sync_meta")
    .maybeSingle();
  const metaMap = (metaRow as { value?: Record<string, { eventsHash?: string }> } | null)?.value ?? {};
  const prevHash = metaMap[caseRowId]?.eventsHash;

  if (prevHash && prevHash === eventsHash) {
    await updateCaseSyncMeta(db, caseRowId, {
      syncedAt: new Date().toISOString(),
      eventsHash,
    });
    return { saved: true, reason: "변경 없음(스킵)" };
  }

  let merge = { added: 0, updated: 0, removed: 0, changed: false };
  if (incoming.length) {
    merge = await mergeCourtSyncDeadlines(db, caseRowId, incoming);
  }

  if (merge.changed) {
    await db.from("timeline").insert({
      case_id: caseRowId,
      type: "court_sync",
      title: "법원기일 자동연동",
      content: `${d.caseNumber} — 기일 변경 반영 (추가 ${merge.added}, 수정 ${merge.updated}, 삭제 ${merge.removed})`,
      author_name: "법원기일연동",
      metadata: {
        caseNumber: d.caseNumber,
        court: d.court,
        added: merge.added,
        updated: merge.updated,
        removed: merge.removed,
        source: "auto_sync",
      },
    });
  }

  await updateCaseSyncMeta(db, caseRowId, {
    syncedAt: new Date().toISOString(),
    eventsHash,
    lastError: undefined,
  });

  return { saved: true, reason: merge.changed ? undefined : "변경 없음" };
}

/** "2025.12.31" / "2025-12-31" → "2025-12-31" */
function normalizeDate(s: string): string {
  const m = s.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
