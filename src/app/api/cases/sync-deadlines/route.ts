/**
 * 법원기일연동 API
 */

import { NextRequest, NextResponse } from "next/server";
import {
  syncCaseDeadlines,
  type SyncCaseRecord,
} from "@/lib/courtDeadlineSync";
import { buildScourtJobFromCase } from "@/lib/scourtCaseParams";
import { maskCaseFields, shouldMaskTrialNames } from "@/lib/trialNameMask";
import { getClientIdentifier, LIMIT_COURT_SYNC_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import {
  enqueueAutoSyncBatch,
  pickCasesForAutoSync,
} from "@/lib/courtDeadlineAutoSync";
import { applyTenantFilter, requireTenantSession } from "@/lib/tenantScope";

export const maxDuration = 300;

const LIMIT_PER_MIN = LIMIT_COURT_SYNC_PER_MIN;

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession({ pathname: "/api/cases/sync-deadlines" });
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  const maskNames = shouldMaskTrialNames(managementNumber, request);

  const status = request.nextUrl.searchParams.get("status") ?? "진행중";
  const pageSize = 500;
  let from = 0;
  const all: SyncCaseRecord[] = [];

  while (true) {
    let q = db
      .from("cases")
      .select("id, case_number, court, client_name, status")
      .range(from, from + pageSize - 1);
    q = applyTenantFilter(q, managementNumber);
    if (status) q = q.eq("status", status);
    const { data, error } = await q.order("case_number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.length) break;
    all.push(...(data as SyncCaseRecord[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const syncable = all.filter((c) => !("error" in buildScourtJobFromCase(c)));
  const skipped = all.length - syncable.length;

  return NextResponse.json({
    managementNumber,
    total: all.length,
    syncable: syncable.length,
    skipped,
    cases: syncable.map((c) =>
      maskNames
        ? maskCaseFields({
            id: c.id,
            caseNumber: c.case_number,
            court: c.court,
            clientName: c.client_name,
          })
        : {
            id: c.id,
            caseNumber: c.case_number,
            court: c.court,
            clientName: c.client_name,
          }
    ),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession({ pathname: "/api/cases/sync-deadlines" });
  if ("error" in auth) return auth.error;
  const { session, managementNumber } = auth;

  const clientId = getClientIdentifier(request);
  const limited = enforceRateLimit(
    request,
    `court-sync:${session.userId || clientId}`,
    LIMIT_PER_MIN,
    { routePath: "/api/cases/sync-deadlines", source: "api" }
  );
  if (limited) return limited;

  let body: {
    caseId?: string;
    all?: boolean;
    auto?: boolean;
    limit?: number;
    status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  if (body.auto) {
    const limit =
      typeof body.limit === "number" && body.limit > 0
        ? Math.min(body.limit, 30)
        : 12;
    const candidates = await pickCasesForAutoSync(limit);
    const batch = await enqueueAutoSyncBatch(limit);
    return NextResponse.json({
      ok: true,
      mode: "auto_enqueue",
      limit,
      candidates: candidates.map((c) => ({
        id: c.id,
        caseNumber: c.case_number,
        reason: c.reason,
        priority: c.priority,
      })),
      enqueued: batch.enqueued,
    });
  }

  if (body.all) {
    const base = new URL(request.url);
    base.searchParams.set("status", body.status ?? "진행중");
    const listRes = await GET(new NextRequest(base.toString(), { headers: request.headers }));
    return listRes;
  }

  const caseId = body.caseId?.trim();
  if (!caseId) {
    return NextResponse.json({ error: "caseId 가 필요합니다." }, { status: 400 });
  }

  const result = await syncCaseDeadlines(caseId, session.userId, managementNumber);
  const statusCode = result.ok ? 200 : result.skipped ? 422 : 502;
  return NextResponse.json(result, { status: statusCode });
}
