/**
 * 법원기일연동 — 나의사건검색 봇 조회 → deadlines/timeline 반영
 */
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import {
  buildScourtJobFromCase,
  type SyncCaseInput,
} from "@/lib/scourtCaseParams";
import {
  callScourtBot,
  isBotConfigured,
  type ScourtJob,
  type ScourtOutcome,
} from "@/lib/scourtBot";
import {
  enqueueScourtJob,
  getScourtJob,
  isQueueConfigured,
  jobToOutcome,
  waitForScourtJob,
} from "@/lib/scourtQueue";
import {
  buildIncomingCourtSyncRows,
  computeCourtEventsHash,
  mergeCourtSyncDeadlines,
} from "@/lib/deadlineCourtSyncMerge";
import { loadCaseSyncMeta, updateCaseSyncMeta } from "@/lib/courtDeadlineAutoSync";
import {
  buildAutoDeadlineMemoContent,
  resolveDeadlineForMemo,
  type CaseDeadlineRow,
} from "@/lib/caseDeadlineMemoCore";

export type SyncCaseRecord = SyncCaseInput & { status?: string };

export interface SyncResult {
  ok: boolean;
  caseId: string;
  caseNumber: string;
  clientName: string;
  court: string;
  eventsAdded?: number;
  eventsUpdated?: number;
  eventsUnchanged?: number;
  eventsRemoved?: number;
  eventsTotal?: number;
  skippedNoChange?: boolean;
  /** 기일 변동 시 사건메모함 자동 기록용 본문 */
  deadlineMemoContent?: string;
  deadlineMemoDate?: string;
  deadlineMemoChanged?: boolean;
  /** 법원 조회 메타 (기일 0건이어도 UI 표시용) */
  courtDivision?: string;
  receivedDate?: string;
  syncedCaseName?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

function normalizeDate(s: string): string {
  const m = s.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

async function buildDeadlineMemoForCase(
  caseId: string,
  caseInfo: {
    caseNumber: string;
    clientName: string;
    court: string;
    courtDivision?: string;
  }
): Promise<{ content: string; date: string; deadlineId: string } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: rows, error } = await db
    .from("deadlines")
    .select("id, deadline_date, deadline_type, court, memo")
    .eq("case_id", caseId)
    .order("deadline_date", { ascending: true });

  if (error) return null;

  let courtDivision = caseInfo.courtDivision?.trim() || undefined;
  if (!courtDivision) {
    const { data: caseRow } = await db
      .from("cases")
      .select("court_division")
      .eq("id", caseId)
      .maybeSingle();
    courtDivision = (caseRow?.court_division as string | undefined)?.trim() || undefined;
  }

  const mapped: CaseDeadlineRow[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    date: String(r.deadline_date),
    type: (r.deadline_type as string) ?? undefined,
    court: (r.court as string) ?? undefined,
    memo: (r.memo as string) ?? undefined,
  }));

  const picked = resolveDeadlineForMemo(mapped, {
    caseNumber: caseInfo.caseNumber,
    clientName: caseInfo.clientName,
    court: caseInfo.court,
    courtDivision,
  });
  if (!picked) return null;

  const content = buildAutoDeadlineMemoContent(picked, {
    caseNumber: caseInfo.caseNumber,
    clientName: caseInfo.clientName,
    court: caseInfo.court,
    courtDivision,
  });

  return { content, date: picked.date, deadlineId: picked.id };
}

export async function applyScourtOutcomeToCase(
  caseId: string,
  outcome: ScourtOutcome
): Promise<{
  ok: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsUnchanged: number;
  eventsRemoved: number;
  skippedNoChange: boolean;
  deadlineMemoContent?: string;
  deadlineMemoDate?: string;
  deadlineMemoChanged?: boolean;
  error?: string;
}> {
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      ok: false,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      eventsRemoved: 0,
      skippedNoChange: false,
      error: "DB 미연결",
    };
  }

  if (!outcome.ok) {
    return {
      ok: false,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      eventsRemoved: 0,
      skippedNoChange: false,
      error: outcome.error ?? "조회 실패",
    };
  }

  if (outcome.notFound) {
    await updateCaseSyncMeta(caseId, {
      lastError: "법원에 해당 사건 없음",
      syncedAt: new Date().toISOString(),
    });
    return {
      ok: false,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      eventsRemoved: 0,
      skippedNoChange: false,
      error: "법원에 해당 사건 없음 — 계속기관·의뢰인명·사건번호를 확인하세요.",
    };
  }

  const d = outcome.data;
  if (!d) {
    return {
      ok: false,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      eventsRemoved: 0,
      skippedNoChange: false,
      error: "법원 조회 결과 파싱 실패",
    };
  }

  const incoming = buildIncomingCourtSyncRows(caseId, d.court ?? "", d.events ?? []);
  const eventsHash = computeCourtEventsHash(incoming);
  const meta = await loadCaseSyncMeta();
  const prevHash = meta[caseId]?.eventsHash;
  const courtDivisionIncoming = d.court_division?.trim() || "";

  const { data: prevCaseRow } = await db
    .from("cases")
    .select("court_division, management_number")
    .eq("id", caseId)
    .maybeSingle();
  const courtDivisionUpdated =
    Boolean(courtDivisionIncoming) &&
    (prevCaseRow?.court_division as string | undefined)?.trim() !== courtDivisionIncoming;
  const caseManagementNumber =
    (prevCaseRow?.management_number as string | undefined)?.trim() || "";

  if (prevHash && prevHash === eventsHash) {
    let needsReapply = false;
    const { count: courtSyncCount } = await db
      .from("deadlines")
      .select("id", { count: "exact", head: true })
      .eq("case_id", caseId)
      .ilike("memo", "%[court_sync]%");
    const syncedRows = courtSyncCount ?? 0;
    if (incoming.length > 0 && syncedRows === 0) {
      needsReapply = true;
    } else if (incoming.length > 0 && syncedRows !== incoming.length) {
      needsReapply = true;
    } else if (incoming.length === 0 && syncedRows > 0) {
      needsReapply = true;
    } else if (caseManagementNumber && syncedRows > 0) {
      const { data: syncRows } = await db
        .from("deadlines")
        .select("management_number")
        .eq("case_id", caseId)
        .ilike("memo", "%[court_sync]%")
        .limit(20);
      if (
        syncRows?.some(
          (r) => (r.management_number as string | undefined)?.trim() !== caseManagementNumber
        )
      ) {
        needsReapply = true;
      }
    }
    if (!needsReapply && !courtDivisionUpdated) {
      await updateCaseSyncMeta(caseId, {
        syncedAt: new Date().toISOString(),
        eventsHash,
        lastError: undefined,
      });
      return {
        ok: true,
        eventsAdded: 0,
        eventsUpdated: 0,
        eventsUnchanged: incoming.length,
        eventsRemoved: 0,
        skippedNoChange: true,
      };
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.caseName) update.case_name = d.caseName;
  if (d.court) update.court = d.court;
  if (d.court_division?.trim()) update.court_division = d.court_division.trim();
  if (d.receivedDate) {
    const rd = normalizeDate(d.receivedDate);
    if (rd) update.received_date = rd;
  }
  if (d.finalResult) {
    update.status = "종결";
    update.closed_type = d.finalResult;
  }
  await db.from("cases").update(update).eq("id", caseId);

  let merge = { added: 0, updated: 0, unchanged: 0, removed: 0, changed: false };
  try {
    merge = await mergeCourtSyncDeadlines(db, caseId, incoming);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "기일 반영 실패";
    await updateCaseSyncMeta(caseId, { lastError: msg, syncedAt: new Date().toISOString() });
    return {
      ok: false,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      eventsRemoved: 0,
      skippedNoChange: false,
      error: msg,
    };
  }

  let deadlineMemoContent: string | undefined;
  let deadlineMemoDate: string | undefined;
  let deadlineMemoChanged = false;
  const shouldRecordMemo = merge.changed || courtDivisionUpdated;

  if (shouldRecordMemo) {
    const memoPack = await buildDeadlineMemoForCase(caseId, {
      caseNumber: d.caseNumber ?? "",
      clientName: d.client ?? "",
      court: d.court ?? "",
      courtDivision: d.court_division,
    });
    if (memoPack) {
      deadlineMemoContent = memoPack.content;
      deadlineMemoDate = memoPack.date;
      deadlineMemoChanged = true;
    }

    const timelineContent = deadlineMemoContent
      ? deadlineMemoContent
      : merge.changed
        ? `${d.caseNumber} — 기일 변경 반영 (추가 ${merge.added}, 수정 ${merge.updated}, 삭제 ${merge.removed})`
        : `${d.caseNumber} — 기관연락처 갱신`;

    await db.from("timeline").insert({
      case_id: caseId,
      type: "court_sync",
      title: "법원기일연동",
      content: timelineContent,
      author_name: "법원기일연동",
      metadata: {
        caseNumber: d.caseNumber,
        court: d.court,
        added: merge.added,
        updated: merge.updated,
        removed: merge.removed,
        unchanged: merge.unchanged,
        captchaAttempts: outcome.captchaAttempts,
        source: "court_sync_deadline",
        deadlineMemo: deadlineMemoContent,
        courtDivisionUpdated,
      },
    });
  }

  await updateCaseSyncMeta(caseId, {
    syncedAt: new Date().toISOString(),
    eventsHash,
    lastError: undefined,
  });

  return {
    ok: true,
    eventsAdded: merge.added,
    eventsUpdated: merge.updated,
    eventsUnchanged: merge.unchanged,
    eventsRemoved: merge.removed,
    skippedNoChange: !merge.changed && !courtDivisionUpdated,
    deadlineMemoContent,
    deadlineMemoDate,
    deadlineMemoChanged,
  };
}

async function fetchScourtOutcome(
  job: ScourtJob,
  userId: string
): Promise<ScourtOutcome | { error: string }> {
  // Supabase 큐 우선 — Vercel 은 Playwright 불가, SCOURT_BOT_URL 이 있어도 큐가 정상 경로
  if (isQueueConfigured()) {
    const enq = await enqueueScourtJob(userId, job, true);
    if (!enq.ok) return { error: enq.error };

    const row = await waitForScourtJob(enq.jobId, userId, 120_000, 1000);
    if (!row) return { error: "작업 시간 초과" };
    if (row.status === "pending" || row.status === "processing") {
      return { error: "로컬 봇 워커(npm run queue)가 실행 중인지 확인하세요." };
    }
    const outcome = jobToOutcome(row);
    if (!outcome) return { error: row.error ?? "조회 결과 없음" };
    return outcome;
  }

  if (isBotConfigured()) {
    const result = await callScourtBot([job], true);
    if (!result.ok) return { error: result.error ?? "봇 호출 실패" };
    const outcome = result.results?.[0];
    if (!outcome) return { error: "봇 응답 없음" };
    return outcome;
  }

  return {
    error: "봇 미설정. bot/ 에서 ddddocr + npm run queue 를 실행하세요.",
  };
}

function metaFromOutcome(outcome: ScourtOutcome): {
  courtDivision?: string;
  receivedDate?: string;
  syncedCaseName?: string;
  eventsTotal?: number;
} {
  const d = outcome.data;
  if (!d) return {};
  const events = d.events ?? [];
  return {
    courtDivision: d.court_division?.trim() || undefined,
    receivedDate: d.receivedDate?.trim() || undefined,
    syncedCaseName: d.caseName?.trim() || undefined,
    eventsTotal: events.length,
  };
}

function buildSyncResult(
  rec: SyncCaseRecord,
  caseId: string,
  applied: Awaited<ReturnType<typeof applyScourtOutcomeToCase>>,
  outcome?: ScourtOutcome
): SyncResult {
  const meta = outcome ? metaFromOutcome(outcome) : {};
  return {
    ok: applied.ok,
    caseId,
    caseNumber: rec.case_number,
    clientName: rec.client_name,
    court: rec.court,
    eventsAdded: applied.eventsAdded,
    eventsUpdated: applied.eventsUpdated,
    eventsUnchanged: applied.eventsUnchanged,
    eventsRemoved: applied.eventsRemoved,
    eventsTotal: meta.eventsTotal,
    skippedNoChange: applied.skippedNoChange,
    deadlineMemoContent: applied.deadlineMemoContent,
    deadlineMemoDate: applied.deadlineMemoDate,
    deadlineMemoChanged: applied.deadlineMemoChanged,
    courtDivision: meta.courtDivision,
    receivedDate: meta.receivedDate,
    syncedCaseName: meta.syncedCaseName,
    error: applied.error,
  };
}

/** 단건 법원기일연동 — 동일 관리번호(테넌트) 사건만 */
export async function syncCaseDeadlines(
  caseId: string,
  userId: string,
  managementNumber: string
): Promise<SyncResult> {
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      ok: false,
      caseId,
      caseNumber: "",
      clientName: "",
      court: "",
      error: "DB 미연결",
    };
  }

  const mn = managementNumber.trim();
  const { data: row, error } = await db
    .from("cases")
    .select("id, case_number, court, client_name, status, management_number")
    .eq("id", caseId)
    .eq("management_number", mn)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      caseId,
      caseNumber: "",
      clientName: "",
      court: "",
      error: "해당 관리번호의 사건을 찾을 수 없습니다.",
    };
  }

  const rec = row as SyncCaseRecord;
  const built = buildScourtJobFromCase(rec);
  if ("error" in built) {
    return {
      ok: false,
      caseId,
      caseNumber: rec.case_number,
      clientName: rec.client_name,
      court: rec.court,
      skipped: true,
      skipReason: built.error,
      error: built.error,
    };
  }

  const fetched = await fetchScourtOutcome(built.job, userId);
  if ("error" in fetched) {
    await updateCaseSyncMeta(caseId, {
      lastError: fetched.error,
      syncedAt: new Date().toISOString(),
    });
    return {
      ok: false,
      caseId,
      caseNumber: rec.case_number,
      clientName: rec.client_name,
      court: rec.court,
      error: fetched.error,
    };
  }

  const applied = await applyScourtOutcomeToCase(caseId, fetched);
  return buildSyncResult(rec, caseId, applied, fetched);
}

/** 나의사건검색 폼 값으로 조회 후 해당 사건에 기일 반영 */
export async function syncCaseDeadlinesFromJob(
  caseId: string,
  userId: string,
  job: ScourtJob,
  managementNumber: string
): Promise<SyncResult> {
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      ok: false,
      caseId,
      caseNumber: "",
      clientName: "",
      court: "",
      error: "DB 미연결",
    };
  }

  const mn = managementNumber.trim();
  const { data: row, error } = await db
    .from("cases")
    .select("id, case_number, court, client_name, status, management_number")
    .eq("id", caseId)
    .eq("management_number", mn)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      caseId,
      caseNumber: "",
      clientName: "",
      court: "",
      error: "해당 관리번호의 사건을 찾을 수 없습니다.",
    };
  }

  const rec = row as SyncCaseRecord;
  const fetched = await fetchScourtOutcome(job, userId);
  if ("error" in fetched) {
    await updateCaseSyncMeta(caseId, {
      lastError: fetched.error,
      syncedAt: new Date().toISOString(),
    });
    return {
      ok: false,
      caseId,
      caseNumber: rec.case_number,
      clientName: rec.client_name,
      court: rec.court,
      error: fetched.error,
    };
  }

  const applied = await applyScourtOutcomeToCase(caseId, fetched);
  return buildSyncResult(rec, caseId, applied, fetched);
}

/** 큐에 완료된 job 결과를 사건에 반영 (재조회 없음) */
export async function syncCaseDeadlinesFromJobId(
  caseId: string,
  userId: string,
  jobId: string,
  managementNumber: string
): Promise<SyncResult> {
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      ok: false,
      caseId,
      caseNumber: "",
      clientName: "",
      court: "",
      error: "DB 미연결",
    };
  }

  const mn = managementNumber.trim();
  const { data: row, error } = await db
    .from("cases")
    .select("id, case_number, court, client_name, status, management_number")
    .eq("id", caseId)
    .eq("management_number", mn)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      caseId,
      caseNumber: "",
      clientName: "",
      court: "",
      error: "해당 관리번호의 사건을 찾을 수 없습니다.",
    };
  }

  const rec = row as SyncCaseRecord;
  const jobRow = await getScourtJob(jobId, userId);
  if (!jobRow) {
    return {
      ok: false,
      caseId,
      caseNumber: rec.case_number,
      clientName: rec.client_name,
      court: rec.court,
      error: "법원 조회 작업을 찾을 수 없습니다.",
    };
  }
  if (jobRow.status === "pending" || jobRow.status === "processing") {
    return {
      ok: false,
      caseId,
      caseNumber: rec.case_number,
      clientName: rec.client_name,
      court: rec.court,
      error: "법원 조회가 아직 완료되지 않았습니다.",
    };
  }

  const outcome = jobToOutcome(jobRow);
  if (!outcome) {
    return {
      ok: false,
      caseId,
      caseNumber: rec.case_number,
      clientName: rec.client_name,
      court: rec.court,
      error: jobRow.error ?? "조회 결과가 없습니다.",
    };
  }
  if (!outcome.ok) {
    await updateCaseSyncMeta(caseId, {
      lastError: outcome.error ?? "조회 실패",
      syncedAt: new Date().toISOString(),
    });
    return {
      ok: false,
      caseId,
      caseNumber: rec.case_number,
      clientName: rec.client_name,
      court: rec.court,
      error: outcome.error ?? "법원 조회 실패",
    };
  }

  const applied = await applyScourtOutcomeToCase(caseId, outcome);
  return buildSyncResult(rec, caseId, applied, outcome);
}

