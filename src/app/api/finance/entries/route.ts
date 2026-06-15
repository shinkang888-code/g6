/**
 * POST /api/finance/entries — 미수금·청구 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { applyCaseBilling, applyCasePayment, mapFinanceEntryRow } from "@/lib/financeServer";
import { assertCaseInTenant, requireTenantSession, tenantRowFields } from "@/lib/tenantScope";

const ENTRY_TYPES = ["수납", "지출", "미수금"] as const;

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: {
    caseId?: string;
    caseNumber?: string;
    clientName?: string;
    amount?: number;
    description?: string;
    date?: string;
    type?: string;
    billingItemId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const entryType = (body.type ?? "미수금").trim();
  if (!ENTRY_TYPES.includes(entryType as (typeof ENTRY_TYPES)[number])) {
    return NextResponse.json({ error: "유효하지 않은 유형입니다." }, { status: 400 });
  }

  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "금액을 입력하세요." }, { status: 400 });
  }

  const caseId = (body.caseId ?? "").trim();
  let caseNumber = (body.caseNumber ?? "").trim();
  let clientName = (body.clientName ?? "").trim();

  if (caseId) {
    const ok = await assertCaseInTenant(db, caseId, managementNumber);
    if (!ok) {
      return NextResponse.json({ error: "해당 사건을 찾을 수 없습니다." }, { status: 404 });
    }
    const { data: caseRow } = await db
      .from("cases")
      .select("case_number, client_name")
      .eq("id", caseId)
      .maybeSingle();
    if (caseRow) {
      caseNumber = caseNumber || String(caseRow.case_number ?? "");
      clientName = clientName || String(caseRow.client_name ?? "");
    }
  }

  if (!clientName) {
    return NextResponse.json({ error: "의뢰인명을 입력하세요." }, { status: 400 });
  }

  const entryDate = (body.date ?? "").trim() || new Date().toISOString().slice(0, 10);

  const { data, error } = await db
    .from("finance_entries")
    .insert({
      entry_type: entryType,
      case_id: caseId || null,
      case_number: caseNumber || null,
      client_name: clientName,
      amount,
      entry_date: entryDate,
      description: (body.description ?? "").trim() || null,
      status: entryType === "수납" ? "확인" : "미확인",
      billing_item_id: (body.billingItemId ?? "").trim() || null,
      ...tenantRowFields(managementNumber),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entryRow = data as Parameters<typeof mapFinanceEntryRow>[0];

  if (caseId) {
    try {
      if (entryType === "미수금") {
        await applyCaseBilling(db, caseId, amount, managementNumber);
      } else if (entryType === "수납") {
        await applyCasePayment(db, caseId, amount, managementNumber);
      }
    } catch (e) {
      console.error("case amount update:", e);
    }
  }

  return NextResponse.json({
    success: true,
    entry: mapFinanceEntryRow(entryRow),
  });
}
