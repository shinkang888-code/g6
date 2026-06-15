/**
 * GET /api/finance/stats — 통계/분석 대시보드 데이터
 */

import { NextResponse } from "next/server";
import { loadFinanceStats } from "@/lib/financeBillingServer";
import { requireTenantSession } from "@/lib/tenantScope";

export async function GET() {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  try {
    const stats = await loadFinanceStats(db, managementNumber);
    return NextResponse.json({ ...stats, managementNumber });
  } catch (e) {
    const message = e instanceof Error ? e.message : "통계 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
