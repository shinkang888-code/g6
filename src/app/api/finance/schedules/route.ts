/**
 * GET  /api/finance/schedules?caseId= — 반복 청구 스케줄
 * POST /api/finance/schedules — 스케줄 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCaseInTenant, requireTenantSession, tenantRowFields } from "@/lib/tenantScope";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const caseId = request.nextUrl.searchParams.get("caseId")?.trim();
  let query = db
    .from("billing_schedules")
    .select("*")
    .eq("management_number", managementNumber)
    .eq("active", true)
    .order("next_bill_date", { ascending: true });

  if (caseId) query = query.eq("case_id", caseId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ schedules: data ?? [], managementNumber });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: {
    caseId?: string;
    billingItemId?: string;
    amount?: number;
    intervalMonths?: number;
    nextBillDate?: string;
    description?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const caseId = (body.caseId ?? "").trim();
  const amount = Number(body.amount ?? 0);
  if (!caseId || amount <= 0) {
    return NextResponse.json({ error: "사건과 금액이 필요합니다." }, { status: 400 });
  }

  const ok = await assertCaseInTenant(db, caseId, managementNumber);
  if (!ok) {
    return NextResponse.json({ error: "해당 사건을 찾을 수 없습니다." }, { status: 404 });
  }

  const nextBillDate = (body.nextBillDate ?? "").trim() || new Date().toISOString().slice(0, 10);
  const intervalMonths = Math.min(12, Math.max(1, Number(body.intervalMonths ?? 1)));

  const { data, error } = await db
    .from("billing_schedules")
    .insert({
      case_id: caseId,
      billing_item_id: body.billingItemId?.trim() || null,
      amount,
      interval_months: intervalMonths,
      next_bill_date: nextBillDate,
      description: (body.description ?? "").trim() || null,
      ...tenantRowFields(managementNumber),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, schedule: data });
}
