/**
 * Supabase 작업 큐 — Vercel ↔ 로컬 봇 연동 (Railway 불필요)
 * POST /api/court-case → jobs INSERT → 로컬 `npm run queue` 가 poll → result UPDATE
 */
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import type { ScourtJob, ScourtOutcome } from "@/lib/scourtBot";

export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface ScourtJobRow {
  id: string;
  user_id: string;
  status: JobStatus;
  params: ScourtJob;
  save_to_case: boolean;
  match_case_id: string | null;
  result: ScourtOutcome | null;
  error: string | null;
  captcha_attempts: number | null;
  created_at: string;
  finished_at: string | null;
}

export function isQueueConfigured(): boolean {
  return Boolean(getSupabaseAdmin());
}

/** 조회 작업 enqueue */
export async function enqueueScourtJob(
  userId: string,
  job: ScourtJob,
  save = false
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Supabase가 설정되지 않았습니다." };

  const { data, error } = await db
    .from("scourt_search_jobs")
    .insert({
      user_id: userId,
      status: "pending",
      params: job,
      save_to_case: save,
      match_case_id: job.matchCaseId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "작업 등록 실패" };
  return { ok: true, jobId: (data as { id: string }).id };
}

/** 작업 상태 조회 (본인 job만) */
export async function getScourtJob(
  jobId: string,
  userId: string
): Promise<ScourtJobRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("scourt_search_jobs")
    .select("id,user_id,status,params,save_to_case,match_case_id,result,error,captcha_attempts,created_at,finished_at")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  return (data as ScourtJobRow | null) ?? null;
}

/** JobRow → API 응답 outcome */
export function jobToOutcome(row: ScourtJobRow): ScourtOutcome | null {
  if (row.status === "done" && row.result) return row.result as ScourtOutcome;
  if (row.status === "failed") {
    return {
      ok: false,
      params: row.params,
      error: row.error ?? "조회 실패",
      captchaAttempts: row.captcha_attempts ?? undefined,
    };
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 서버에서 job 완료까지 대기 (최대 timeoutMs) */
export async function waitForScourtJob(
  jobId: string,
  userId: string,
  timeoutMs = 120_000,
  intervalMs = 1000
): Promise<ScourtJobRow | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await getScourtJob(jobId, userId);
    if (!row) return null;
    if (row.status === "done" || row.status === "failed") return row;
    await sleep(intervalMs);
  }
  return await getScourtJob(jobId, userId);
}
