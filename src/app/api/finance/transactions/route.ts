/**
 * POST /api/finance/transactions — 입금 내역 수동 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { mapBankTransactionRow } from "@/lib/financeServer";
import { requireTenantSession, tenantRowFields } from "@/lib/tenantScope";

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: {
    depositorName?: string;
    amount?: number;
    bankName?: string;
    memo?: string;
    date?: string;
    linkedAccountId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const depositorName = (body.depositorName ?? "").trim();
  if (!depositorName) {
    return NextResponse.json({ error: "입금자명을 입력하세요." }, { status: 400 });
  }

  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "금액을 입력하세요." }, { status: 400 });
  }

  const transactionDate = (body.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const linkedAccountId = (body.linkedAccountId ?? "").trim() || null;

  if (linkedAccountId) {
    const { data: acct } = await db
      .from("linked_accounts")
      .select("id")
      .eq("id", linkedAccountId)
      .eq("management_number", managementNumber)
      .maybeSingle();
    if (!acct) {
      return NextResponse.json({ error: "연동 계좌를 찾을 수 없습니다." }, { status: 404 });
    }
  }

  const { data, error } = await db
    .from("bank_transactions")
    .insert({
      transaction_date: transactionDate,
      depositor_name: depositorName,
      amount,
      bank_name: (body.bankName ?? "").trim() || null,
      memo: (body.memo ?? "").trim() || null,
      linked_account_id: linkedAccountId,
      ...tenantRowFields(managementNumber),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    transaction: mapBankTransactionRow(data as Parameters<typeof mapBankTransactionRow>[0]),
  });
}
