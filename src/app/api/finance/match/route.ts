/**
 * POST /api/finance/match — 입금 ↔ 미수금 매칭 확정
 * body: { pairs: [{ transactionId, entryId }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { confirmFinanceMatches, loadFinanceDashboard } from "@/lib/financeServer";
import { requireTenantSession } from "@/lib/tenantScope";

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber, session } = auth;

  let body: { pairs?: { transactionId?: string; entryId?: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const pairs = Array.isArray(body.pairs) ? body.pairs : [];
  if (pairs.length === 0) {
    return NextResponse.json({ error: "매칭할 항목이 없습니다." }, { status: 400 });
  }

  try {
    const result = await confirmFinanceMatches(
      db,
      managementNumber,
      pairs.map((p) => ({
        transactionId: String(p.transactionId ?? ""),
        entryId: String(p.entryId ?? ""),
      })),
      session.name ?? session.loginId
    );

    const dashboard = await loadFinanceDashboard(db, managementNumber);

    if (result.confirmed === 0 && result.errors.length > 0) {
      return NextResponse.json(
        {
          error: result.errors[0],
          errors: result.errors,
          confirmed: 0,
          ...dashboard,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      confirmed: result.confirmed,
      errors: result.errors,
      ...dashboard,
      managementNumber,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "매칭 처리 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
