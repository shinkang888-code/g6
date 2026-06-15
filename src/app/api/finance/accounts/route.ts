/**
 * GET  /api/finance/accounts — 연동 계좌 목록
 * POST /api/finance/accounts — 계좌 수동 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { loadLinkedAccounts, mapLinkedAccountRow, maskAccountNumber } from "@/lib/financeServer";
import { requireTenantSession, tenantRowFields } from "@/lib/tenantScope";

export async function GET() {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  try {
    const accounts = await loadLinkedAccounts(db, managementNumber);
    return NextResponse.json({ accounts, managementNumber });
  } catch (e) {
    const message = e instanceof Error ? e.message : "계좌 목록 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    displayName?: string;
    balance?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const bankName = (body.bankName ?? "").trim();
  const accountNumber = (body.accountNumber ?? "").trim();
  if (!bankName || !accountNumber) {
    return NextResponse.json({ error: "은행명과 계좌번호를 입력하세요." }, { status: 400 });
  }

  const { data, error } = await db
    .from("linked_accounts")
    .insert({
      bank_name: bankName,
      account_number_masked: maskAccountNumber(accountNumber),
      account_holder: (body.accountHolder ?? "").trim() || null,
      display_name: (body.displayName ?? "").trim() || null,
      balance: Number.isFinite(Number(body.balance)) ? Number(body.balance) : null,
      source: "manual",
      ...tenantRowFields(managementNumber),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    account: mapLinkedAccountRow(data as Parameters<typeof mapLinkedAccountRow>[0]),
  });
}
