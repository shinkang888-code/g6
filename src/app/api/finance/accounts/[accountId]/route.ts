/**
 * GET /api/finance/accounts/[accountId] — 계좌 정보 + 거래내역
 */

import { NextResponse } from "next/server";
import {
  linkedAccountLabel,
  loadAccountTransactions,
  mapLinkedAccountRow,
} from "@/lib/financeServer";
import { requireTenantSession } from "@/lib/tenantScope";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const { accountId } = await context.params;
  const id = accountId?.trim();
  if (!id) {
    return NextResponse.json({ error: "계좌 ID가 필요합니다." }, { status: 400 });
  }

  const { data: row, error } = await db
    .from("linked_accounts")
    .select("*")
    .eq("id", id)
    .eq("management_number", managementNumber)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "계좌를 찾을 수 없습니다." }, { status: 404 });
  }

  const account = mapLinkedAccountRow(row as Parameters<typeof mapLinkedAccountRow>[0]);
  const transactions = await loadAccountTransactions(db, id, managementNumber);

  return NextResponse.json({
    account,
    label: linkedAccountLabel(account),
    transactions,
    managementNumber,
  });
}
