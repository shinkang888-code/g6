/**
 * 나의사건검색 조회 결과 폴링 (클라이언트 공용)
 */
import type { ScourtJob } from "@/lib/scourtBot";
import { publishScourtSync } from "@/lib/scourtSyncBridge";

export type ScourtBotEvent = {
  date?: string;
  type?: string;
  detail?: string;
  result?: string;
};

export type ScourtBotData = {
  caseNumber: string;
  caseName?: string;
  court?: string;
  defendantName?: string;
  court_division?: string;
  receivedDate?: string;
  finalResult?: string;
  events?: ScourtBotEvent[];
  rawLine?: string;
};

export type ScourtBotOutcome = {
  ok: boolean;
  notFound?: boolean;
  error?: string;
  captchaAttempts?: number;
  data?: ScourtBotData;
};

export async function pollCourtCaseJob(jobId: string, timeoutMs = 120_000): Promise<ScourtBotOutcome | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`/api/court-case?jobId=${jobId}`, { credentials: "include" });
    const pj = await poll.json();
    if (!poll.ok) {
      throw new Error(pj.error || "조회 상태 확인 실패");
    }
    if (pj.pending) continue;
    return (pj.results?.[0] as ScourtBotOutcome) ?? null;
  }
  throw new Error("조회 시간이 초과되었습니다. 로컬 봇(npm run queue)이 실행 중인지 확인하세요.");
}

export async function runCourtCaseSearch(job: ScourtJob): Promise<ScourtBotOutcome | null> {
  const res = await fetch("/api/court-case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ job, async: true }),
  });
  const json = await res.json();
  if (!res.ok && res.status !== 202) {
    throw new Error(json.hint ? `${json.error}\n${json.hint}` : json.error || "조회에 실패했습니다.");
  }

  const jobId = json.jobId as string | undefined;
  if (!jobId) {
    return (json.results?.[0] as ScourtBotOutcome) ?? null;
  }
  return pollCourtCaseJob(jobId);
}

export function notifyScourtSyncOpener(payload: Record<string, unknown>) {
  publishScourtSync(payload as Parameters<typeof publishScourtSync>[0]);
}
