/**
 * 법원기일 자동연동 — 대상 선정·메타(해시/시각) 관리
 */
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { buildScourtJobFromCase, type SyncCaseInput } from "@/lib/scourtCaseParams";
import { enqueueScourtJob } from "@/lib/scourtQueue";
import { getAppSetting, setAppSetting } from "@/lib/appSettingsServer";
import { getDDay } from "@/lib/utils";

export const COURT_SYNC_META_KEY = "court_deadline_sync_meta";
export const AUTO_SYNC_USER_ID = "court-auto-sync";

export type CaseSyncMeta = {
  syncedAt: string;
  eventsHash: string;
  lastError?: string;
};

export type CaseSyncMetaMap = Record<string, CaseSyncMeta>;

export type AutoSyncCandidate = SyncCaseInput & {
  status?: string;
  nextDeadlineDate?: string | null;
  priority: number;
  reason: string;
};

const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간
const STALE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24시간

export async function loadCaseSyncMeta(): Promise<CaseSyncMetaMap> {
  const raw = await getAppSetting<CaseSyncMetaMap>(COURT_SYNC_META_KEY);
  return raw && typeof raw === "object" ? raw : {};
}

export async function saveCaseSyncMeta(map: CaseSyncMetaMap): Promise<void> {
  await setAppSetting(COURT_SYNC_META_KEY, map);
}

export async function updateCaseSyncMeta(
  caseId: string,
  patch: Partial<CaseSyncMeta>
): Promise<void> {
  const map = await loadCaseSyncMeta();
  map[caseId] = {
    ...map[caseId],
    ...patch,
    syncedAt: patch.syncedAt ?? map[caseId]?.syncedAt ?? new Date().toISOString(),
    eventsHash: patch.eventsHash ?? map[caseId]?.eventsHash ?? "",
  };
  await saveCaseSyncMeta(map);
}

/** 자동 연동 우선순위 점수 */
export function scoreAutoSyncCase(
  c: SyncCaseInput & { status?: string },
  meta: CaseSyncMeta | undefined,
  nextDeadlineDate: string | null
): { priority: number; reason: string } | null {
  if (c.status && c.status !== "진행중") return null;
  if ("error" in buildScourtJobFromCase(c)) return null;

  const now = Date.now();
  const lastAt = meta?.syncedAt ? new Date(meta.syncedAt).getTime() : 0;
  const elapsed = lastAt ? now - lastAt : Infinity;
  const dday =
    nextDeadlineDate && !Number.isNaN(new Date(nextDeadlineDate).getTime())
      ? getDDay(nextDeadlineDate)
      : null;

  if (!meta?.syncedAt) {
    return { priority: 100, reason: "미연동" };
  }
  if (dday !== null && dday >= 0 && dday <= 3) {
    return { priority: 90, reason: `기일 임박 D-${dday}` };
  }
  if (dday !== null && dday >= 0 && dday <= 7 && elapsed >= MIN_INTERVAL_MS) {
    return { priority: 75, reason: "7일 이내 기일" };
  }
  if (elapsed >= 7 * 24 * 60 * 60 * 1000) {
    return { priority: 50, reason: "7일 이상 미갱신" };
  }
  if (elapsed >= STALE_INTERVAL_MS) {
    return { priority: 40, reason: "24시간 이상 미갱신" };
  }
  if (dday !== null && dday > 14 && elapsed < MIN_INTERVAL_MS) {
    return null; // 여유 기일 + 최근 연동 → 스킵
  }
  if (elapsed >= MIN_INTERVAL_MS) {
    return { priority: 20, reason: "정기 갱신" };
  }
  return null;
}

/** 자동 연동 대상 사건 선정 */
export async function pickCasesForAutoSync(
  limit: number
): Promise<AutoSyncCandidate[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const meta = await loadCaseSyncMeta();
  const today = new Date().toISOString().slice(0, 10);
  const pageSize = 500;
  let from = 0;
  const all: (SyncCaseInput & { status?: string })[] = [];

  while (true) {
    const { data, error } = await db
      .from("cases")
      .select("id, case_number, court, client_name, status")
      .eq("status", "진행중")
      .range(from, from + pageSize - 1)
      .order("updated_at", { ascending: false });
    if (error || !data?.length) break;
    all.push(...(data as (SyncCaseInput & { status?: string })[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const caseIds = all.map((c) => c.id);
  const nextByCase = new Map<string, string>();
  if (caseIds.length) {
    const { data: dlRows } = await db
      .from("deadlines")
      .select("case_id, deadline_date")
      .in("case_id", caseIds)
      .gte("deadline_date", today)
      .order("deadline_date", { ascending: true });
    for (const r of dlRows ?? []) {
      const cid = r.case_id as string;
      if (!nextByCase.has(cid)) nextByCase.set(cid, r.deadline_date as string);
    }
  }

  const scored: AutoSyncCandidate[] = [];
  for (const c of all) {
    const next = nextByCase.get(c.id) ?? null;
    const s = scoreAutoSyncCase(c, meta[c.id], next);
    if (!s) continue;
    scored.push({
      ...c,
      nextDeadlineDate: next,
      priority: s.priority,
      reason: s.reason,
    });
  }

  scored.sort((a, b) => b.priority - a.priority || a.case_number.localeCompare(b.case_number));
  return scored.slice(0, Math.max(1, limit));
}

/** 큐에 자동 연동 작업 등록 (봇 워커가 비동기 처리) */
export async function enqueueAutoSyncBatch(limit: number): Promise<{
  enqueued: { caseId: string; caseNumber: string; reason: string }[];
  skipped: number;
}> {
  const candidates = await pickCasesForAutoSync(limit);
  const enqueued: { caseId: string; caseNumber: string; reason: string }[] = [];

  for (const c of candidates) {
    const built = buildScourtJobFromCase(c);
    if ("error" in built) continue;
    const res = await enqueueScourtJob(AUTO_SYNC_USER_ID, built.job, true);
    if (res.ok) {
      enqueued.push({
        caseId: c.id,
        caseNumber: c.case_number,
        reason: c.reason,
      });
    }
  }

  return { enqueued, skipped: candidates.length - enqueued.length };
}
