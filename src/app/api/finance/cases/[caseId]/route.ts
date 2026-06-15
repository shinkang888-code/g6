/**
 * GET /api/finance/cases/[caseId] — 사건별 청구·수납 이력
 */

import { NextRequest, NextResponse } from "next/server";
import { loadCaseFinanceHistory, syncOpenReceivablesFromCases } from "@/lib/financeServer";
import { assertCaseInTenant, requireTenantSession } from "@/lib/tenantScope";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const { caseId } = await context.params;
  const id = caseId?.trim();
  if (!id) {
    return NextResponse.json({ error: "사건 ID가 필요합니다." }, { status: 400 });
  }

  const inTenant = await assertCaseInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "해당 사건을 찾을 수 없습니다." }, { status: 404 });
  }

  const sync = request.nextUrl.searchParams.get("sync") !== "0";
  if (sync) {
    try {
      await syncOpenReceivablesFromCases(db, managementNumber);
    } catch (e) {
      console.error("case finance sync:", e);
    }
  }

  try {
    const history = await loadCaseFinanceHistory(db, id, managementNumber);
    const { data: caseRow } = await db
      .from("cases")
      .select("case_number, client_name, amount, received_amount, pending_amount")
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({
      caseId: id,
      caseNumber: caseRow?.case_number ?? "",
      clientName: caseRow?.client_name ?? "",
      amount: Number(caseRow?.amount ?? 0),
      receivedAmount: Number(caseRow?.received_amount ?? 0),
      pendingAmount: Number(caseRow?.pending_amount ?? 0),
      ...history,
      managementNumber,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "사건 수납 이력 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
