/**
 * GET  /api/finance/billing-items — 청구항목 마스터
 * POST /api/finance/billing-items — 항목 추가 또는 반복 청구 실행
 */

import { NextRequest, NextResponse } from "next/server";
import { loadBillingItems, runDueBillingSchedules } from "@/lib/financeBillingServer";
import { requireTenantSession, tenantRowFields } from "@/lib/tenantScope";

export async function GET() {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  try {
    const items = await loadBillingItems(db, managementNumber);
    return NextResponse.json({ items, managementNumber });
  } catch (e) {
    const message = e instanceof Error ? e.message : "청구항목 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: { action?: string; name?: string; defaultAmount?: number; isRecurring?: boolean; recurringDay?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.action === "run-recurring") {
    try {
      const created = await runDueBillingSchedules(db, managementNumber);
      return NextResponse.json({ success: true, createdSchedules: created });
    } catch (e) {
      const message = e instanceof Error ? e.message : "반복 청구 실행 실패";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "항목명을 입력하세요." }, { status: 400 });
  }

  const { data, error } = await db
    .from("billing_items")
    .upsert(
      {
        name,
        default_amount: Number.isFinite(Number(body.defaultAmount)) ? Number(body.defaultAmount) : null,
        is_recurring: Boolean(body.isRecurring),
        recurring_day: body.recurringDay ?? null,
        active: true,
        updated_at: new Date().toISOString(),
        ...tenantRowFields(managementNumber),
      },
      { onConflict: "management_number,name" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, item: data });
}
