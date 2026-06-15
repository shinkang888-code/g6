/**
 * GET  /api/finance — 미매칭 입금·미수금·통계
 * POST /api/finance — 미수금 사건 동기화 (syncReceivables)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadFinanceDashboard,
  loadLinkedAccounts,
  syncOpenReceivablesFromCases,
} from "@/lib/financeServer";
import { requireTenantSession } from "@/lib/tenantScope";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const sync = request.nextUrl.searchParams.get("sync") !== "0";
  let synced = 0;
  if (sync) {
    try {
      synced = await syncOpenReceivablesFromCases(db, managementNumber);
    } catch (e) {
      console.error("finance sync receivables:", e);
    }
  }

  try {
    const [payload, accounts] = await Promise.all([
      loadFinanceDashboard(db, managementNumber),
      loadLinkedAccounts(db, managementNumber),
    ]);
    return NextResponse.json({
      ...payload,
      accounts,
      managementNumber,
      syncedReceivables: synced,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "회계 데이터 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: { action?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  if (body.action === "sync-receivables") {
    try {
      const synced = await syncOpenReceivablesFromCases(db, managementNumber);
      const payload = await loadFinanceDashboard(db, managementNumber);
      return NextResponse.json({
        success: true,
        syncedReceivables: synced,
        ...payload,
        managementNumber,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "동기화 실패";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "지원하지 않는 action입니다." }, { status: 400 });
}
