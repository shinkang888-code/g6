/**
 * 나의사건검색 수동 조회 후 기일 연동
 * POST { caseId, job } — 봇 조회 후 반영
 * POST { caseId, jobId } — 완료된 큐 작업 결과만 반영
 */

import { NextRequest, NextResponse } from "next/server";
import {
  syncCaseDeadlinesFromJob,
  syncCaseDeadlinesFromJobId,
} from "@/lib/courtDeadlineSync";
import { getClientIdentifier, LIMIT_COURT_SYNC_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import { isValidScourtJob } from "@/lib/scourtJobValidate";
import { requireTenantSession } from "@/lib/tenantScope";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession({ pathname: "/api/cases/scourt-link" });
  if ("error" in auth) return auth.error;
  const { session, managementNumber } = auth;

  const limited = enforceRateLimit(
    request,
    `court-link:${session.userId || getClientIdentifier(request)}`,
    LIMIT_COURT_SYNC_PER_MIN,
    { routePath: "/api/cases/scourt-link", source: "api" }
  );
  if (limited) return limited;

  let body: { caseId?: string; job?: unknown; jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const caseId = body.caseId?.trim();
  if (!caseId) {
    return NextResponse.json({ error: "caseId 가 필요합니다." }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (jobId) {
    const result = await syncCaseDeadlinesFromJobId(caseId, session.userId, jobId, managementNumber);
    const statusCode = result.ok ? 200 : result.skipped ? 422 : 502;
    return NextResponse.json(result, { status: statusCode });
  }

  if (!isValidScourtJob(body.job)) {
    return NextResponse.json(
      { error: "필수 항목 누락: courtName, year, gubun, serial, partyName" },
      { status: 400 }
    );
  }

  const result = await syncCaseDeadlinesFromJob(caseId, session.userId, body.job, managementNumber);
  const statusCode = result.ok ? 200 : result.skipped ? 422 : 502;
  return NextResponse.json(result, { status: statusCode });
}
