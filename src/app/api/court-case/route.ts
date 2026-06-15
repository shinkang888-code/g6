/**
 * 대법원 나의사건검색 자동조회
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import { callScourtBot, isBotConfigured, type ScourtJob } from "@/lib/scourtBot";
import {
  enqueueScourtJob,
  getScourtJob,
  isQueueConfigured,
  jobToOutcome,
  waitForScourtJob,
} from "@/lib/scourtQueue";
import { getClientIdentifier, LIMIT_COURT_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

const LIMIT_BOT_PER_MIN = LIMIT_COURT_PER_MIN;

import { isValidScourtJob } from "@/lib/scourtJobValidate";

export const maxDuration = 300;

/** GET /api/court-case?jobId=uuid — 작업 상태 폴링 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId 가 필요합니다." }, { status: 400 });
  }

  const row = await getScourtJob(jobId, session.userId);
  if (!row) {
    return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
  }

  const outcome = jobToOutcome(row);
  return NextResponse.json({
    jobId: row.id,
    status: row.status,
    results: outcome ? [outcome] : undefined,
    pending: row.status === "pending" || row.status === "processing",
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const clientId = getClientIdentifier(request);
  const limited = enforceRateLimit(
    request,
    `court-case:${session.userId || clientId}`,
    LIMIT_BOT_PER_MIN,
    { routePath: "/api/court-case", source: "api" }
  );
  if (limited) return limited;

  let body: { job?: unknown; jobs?: unknown; save?: boolean; async?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawJobs = Array.isArray(body.jobs) ? body.jobs : body.job ? [body.job] : [];
  const jobs = rawJobs.filter(isValidScourtJob);
  if (!jobs.length) {
    return NextResponse.json(
      { error: "필수 항목 누락: courtName, year, gubun, serial, partyName" },
      { status: 400 }
    );
  }
  if (jobs.length > 1) {
    return NextResponse.json({ error: "큐 모드는 한 번에 1건만 조회할 수 있습니다." }, { status: 400 });
  }

  const job = jobs[0];
  const save = body.save === true;

  // 1) Supabase 작업 큐 (Vercel 권장 — 로컬 npm run queue)
  if (isQueueConfigured()) {
    const enq = await enqueueScourtJob(session.userId, job, save);
    if (!enq.ok) {
      return NextResponse.json({ error: enq.error }, { status: 500 });
    }

    // async=false(기본): 서버에서 완료까지 대기 (최대 120s)
    if (body.async !== true) {
      const row = await waitForScourtJob(enq.jobId, session.userId);
      if (!row) {
        return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
      }
      if (row.status === "pending" || row.status === "processing") {
        return NextResponse.json(
          {
            jobId: enq.jobId,
            status: row.status,
            pending: true,
            hint: "로컬 봇 워커(npm run queue)가 실행 중인지 확인하세요.",
          },
          { status: 408 }
        );
      }
      const outcome = jobToOutcome(row);
      return NextResponse.json({
        jobId: enq.jobId,
        status: row.status,
        results: outcome ? [outcome] : undefined,
        mode: "queue",
      });
    }

    return NextResponse.json({ jobId: enq.jobId, status: "pending", mode: "queue" });
  }

  // 2) HTTP 봇 워커 (SCOURT_BOT_URL — 로컬 serve 전용)
  if (isBotConfigured()) {
    const result = await callScourtBot(jobs, save);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 502 });
    }
    return NextResponse.json({ results: result.results, mode: "direct" });
  }

  return NextResponse.json(
    {
      error: "사건검색 봇이 설정되지 않았습니다.",
      code: "BOT_NOT_CONFIGURED",
      hint: "bot/ 에서 ddddocr + npm run queue 를 실행하고, Supabase env 가 Vercel/bot 양쪽에 설정되어 있는지 확인하세요.",
    },
    { status: 503 }
  );
}
