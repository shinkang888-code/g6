/**
 * 기일(deadlines) 조회 API - 사건과 연동
 * GET ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD (달력 기간)
 * GET ?caseId=uuid (사건별 기일)
 *
 * 동일 관리번호(회사) 구성원만 공유. 관리자: 회사 전체 / 그 외: 본인 담당 사건 기일만
 */

import { NextRequest, NextResponse } from "next/server";
import {
  canAccessCaseRow,
  filterDeadlinesForSession,
  isAdminSession,
} from "@/lib/caseStaffAccess";
import { dedupeDeadlinesForDisplay } from "@/lib/deadlineDedup";
import { applyTenantFilter, requireTenantSession } from "@/lib/tenantScope";
import { maskDeadlineList, shouldMaskTrialNames } from "@/lib/trialNameMask";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, session, managementNumber } = auth;
  const maskNames = shouldMaskTrialNames(managementNumber, request);

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const caseId = searchParams.get("caseId") ?? "";

  if (caseId) {
    const allowed = await canAccessCaseRow(db, caseId, session);
    if (!allowed) {
      return NextResponse.json({ data: [] });
    }
  }

  let query = applyTenantFilter(
    db.from("deadlines").select(
      "id, case_id, deadline_date, deadline_type, court, memo, is_immutable, completed_at, created_at, cases!inner(case_number, client_name, court, assigned_staff_name, management_number)"
    ),
    managementNumber
  );

  if (caseId) {
    query = query.eq("case_id", caseId).order("deadline_date", { ascending: true });
  } else {
    query = query.order("deadline_date", { ascending: true });
    if (dateFrom) query = query.gte("deadline_date", dateFrom);
    if (dateTo) query = query.lte("deadline_date", dateTo);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = (data ?? []).map((r: Record<string, unknown>) => {
    const casesRow = r.cases as Record<string, unknown> | null;
    const rawMemo = (r.memo ?? "") as string;
    let memoAssigned = "";
    const m = rawMemo.match(/담당자:\s*([^/·]+)/);
    if (m) memoAssigned = m[1].trim();
    const caseAssigned = String(casesRow?.assigned_staff_name ?? "").trim();
    const caseCourt = (casesRow?.court as string) ?? "";
    return {
      id: String(r.id ?? ""),
      caseId: r.case_id ? String(r.case_id) : undefined,
      caseNumber: String(casesRow?.case_number ?? ""),
      clientName: (casesRow?.client_name as string) ?? "",
      date: String(r.deadline_date ?? ""),
      type: r.deadline_type ? String(r.deadline_type) : undefined,
      court: (r.court as string) || caseCourt || "",
      memo: rawMemo,
      assignedStaff: caseAssigned || memoAssigned,
      isImmutable: Boolean(r.is_immutable),
      completedAt: r.completed_at,
      createdAt: r.created_at ? String(r.created_at) : undefined,
    };
  });

  const scoped = isAdminSession(session) ? list : filterDeadlinesForSession(list, session);
  const deduped = dedupeDeadlinesForDisplay(scoped);
  return NextResponse.json({ data: maskNames ? maskDeadlineList(deduped) : deduped });
}
