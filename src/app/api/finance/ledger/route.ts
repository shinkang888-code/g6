/**
 * GET /api/finance/ledger — 수납대장 (청구·수납·입금 전체)
 */

import { NextRequest, NextResponse } from "next/server";
import { mapBankTransactionRow, mapFinanceEntryRow, linkedAccountLabel, loadLinkedAccounts } from "@/lib/financeServer";
import { requireTenantSession } from "@/lib/tenantScope";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const from = request.nextUrl.searchParams.get("from")?.trim();
  const to = request.nextUrl.searchParams.get("to")?.trim();

  try {
    let entryQuery = db
      .from("finance_entries")
      .select("*")
      .eq("management_number", managementNumber)
      .order("entry_date", { ascending: false })
      .limit(500);

    let txQuery = db
      .from("bank_transactions")
      .select("*")
      .eq("management_number", managementNumber)
      .order("transaction_date", { ascending: false })
      .limit(500);

    if (from) {
      entryQuery = entryQuery.gte("entry_date", from);
      txQuery = txQuery.gte("transaction_date", from);
    }
    if (to) {
      entryQuery = entryQuery.lte("entry_date", to);
      txQuery = txQuery.lte("transaction_date", to);
    }

    const [{ data: entries }, { data: transactions }, accounts] = await Promise.all([
      entryQuery,
      txQuery,
      loadLinkedAccounts(db, managementNumber),
    ]);

    const accountLabels = new Map(accounts.map((a) => [a.id, linkedAccountLabel(a)]));

    return NextResponse.json({
      entries: (entries ?? []).map((r) => mapFinanceEntryRow(r as Parameters<typeof mapFinanceEntryRow>[0])),
      transactions: (transactions ?? []).map((r) =>
        mapBankTransactionRow(r as Parameters<typeof mapBankTransactionRow>[0], accountLabels)
      ),
      managementNumber,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "수납대장 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
