/**
 * 클라이언트 — 나의사건검색 작업 큐 폴링
 */
export type ScourtPollStatus = "pending" | "processing" | "done" | "failed";

export type ScourtPollResult = {
  jobId: string;
  status: ScourtPollStatus;
  pending?: boolean;
  error?: string;
  hint?: string;
};

export async function pollScourtJob(
  jobId: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    onTick?: (status: ScourtPollStatus) => void;
  }
): Promise<ScourtPollResult> {
  const timeoutMs = options?.timeoutMs ?? 130_000;
  const baseIntervalMs = options?.intervalMs ?? 800;
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    const res = await fetch(`/api/court-case?jobId=${encodeURIComponent(jobId)}`, {
      credentials: "include",
    });
    const json = (await res.json()) as {
      jobId?: string;
      status?: ScourtPollStatus;
      pending?: boolean;
      error?: string;
      hint?: string;
    };

    if (!res.ok) {
      return {
        jobId,
        status: "failed",
        error: json.error ?? `조회 실패 (${res.status})`,
        hint: json.hint,
      };
    }

    const status = json.status ?? "pending";
    options?.onTick?.(status);

    if (status === "done" || status === "failed") {
      return { jobId, status, pending: false, error: json.error, hint: json.hint };
    }

    attempt += 1;
    const waitMs = Math.min(baseIntervalMs + attempt * 200, 2_000);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  return {
    jobId,
    status: "pending",
    pending: true,
    error: "법원 조회 시간이 초과되었습니다. 잠시 후 다시 시도하거나 나의사건검색 연동을 이용하세요.",
    hint: "로컬 봇 워커(npm run queue) 실행 여부를 확인하세요.",
  };
}
