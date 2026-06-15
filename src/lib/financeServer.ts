/**
 * 회계/수납 서버 로직 — Phase 0
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankTransaction, FinanceEntry, LinkedAccount } from "@/lib/types";

export type FinanceStats = {
  monthlyReceived: number;
  totalPending: number;
  matchedCount: number;
  pendingTransactionCount: number;
};

export type CaseFinanceSummary = {
  totalAmount: number;
  receivedAmount: number;
  pendingAmount: number;
  billedTotal: number;
  openReceivableTotal: number;
};

export type CaseFinanceHistory = {
  receivables: FinanceEntry[];
  payments: FinanceEntry[];
  summary: CaseFinanceSummary;
};

type FinanceEntryRow = {
  id: string;
  entry_type: string;
  case_id: string | null;
  case_number: string | null;
  client_name: string;
  amount: number | string;
  entry_date: string;
  description: string | null;
  status: string;
  bank_transaction_id: string | null;
  management_number?: string | null;
};

type BankTransactionRow = {
  id: string;
  transaction_date: string;
  depositor_name: string;
  amount: number | string;
  bank_name: string | null;
  memo: string | null;
  matched_finance_id: string | null;
  linked_account_id?: string | null;
  confirmed_at?: string | null;
};

type LinkedAccountRow = {
  id: string;
  bank_code: string | null;
  bank_name: string;
  account_number_masked: string;
  account_holder: string | null;
  display_name: string | null;
  source: string;
  balance: number | string | null;
  last_synced_at: string | null;
};

export function maskAccountNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

export function mapLinkedAccountRow(r: LinkedAccountRow): LinkedAccount {
  const source = r.source as LinkedAccount["source"];
  return {
    id: r.id,
    bankCode: r.bank_code ?? undefined,
    bankName: r.bank_name,
    accountNumberMasked: r.account_number_masked,
    accountHolder: r.account_holder ?? undefined,
    displayName: r.display_name ?? undefined,
    source:
      source === "openbanking" || source === "toss_virtual" || source === "csv_import"
        ? source
        : "manual",
    balance: r.balance != null ? Number(r.balance) : undefined,
    lastSyncedAt: r.last_synced_at ?? undefined,
  };
}

export function linkedAccountLabel(account: LinkedAccount): string {
  const name = account.displayName?.trim() || account.bankName;
  return `${name} ${account.accountNumberMasked}`;
}

export async function loadLinkedAccounts(
  db: SupabaseClient,
  managementNumber: string
): Promise<LinkedAccount[]> {
  const { data } = await db
    .from("linked_accounts")
    .select("*")
    .eq("management_number", managementNumber)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => mapLinkedAccountRow(r as LinkedAccountRow));
}

export async function loadAccountTransactions(
  db: SupabaseClient,
  accountId: string,
  managementNumber: string,
  limit = 100
): Promise<BankTransaction[]> {
  const { data } = await db
    .from("bank_transactions")
    .select("*")
    .eq("linked_account_id", accountId)
    .eq("management_number", managementNumber)
    .order("transaction_date", { ascending: false })
    .limit(limit);
  const account = await db
    .from("linked_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("management_number", managementNumber)
    .maybeSingle();
  const label = account.data ? linkedAccountLabel(mapLinkedAccountRow(account.data as LinkedAccountRow)) : "";
  return (data ?? []).map((r) => ({
    ...mapBankTransactionRow(r as BankTransactionRow),
    linkedAccountId: accountId,
    linkedAccountLabel: label,
  }));
}

export function mapFinanceEntryRow(r: FinanceEntryRow): FinanceEntry {
  const type = r.entry_type as FinanceEntry["type"];
  return {
    id: r.id,
    type: type === "수납" || type === "지출" || type === "미수금" ? type : "미수금",
    caseId: r.case_id ?? "",
    caseNumber: r.case_number ?? "",
    clientName: r.client_name,
    amount: Number(r.amount ?? 0),
    date: r.entry_date,
    description: r.description ?? "",
    status: (r.status as FinanceEntry["status"]) ?? "미확인",
    bankTransactionId: r.bank_transaction_id ?? undefined,
  };
}

export function mapBankTransactionRow(
  r: BankTransactionRow,
  accountLabels?: Map<string, string>
): BankTransaction {
  const linkedId = r.linked_account_id ?? undefined;
  return {
    id: r.id,
    date: r.transaction_date,
    depositorName: r.depositor_name,
    amount: Number(r.amount ?? 0),
    bankName: r.bank_name ?? "",
    memo: r.memo ?? "",
    matchedTo: r.matched_finance_id ?? undefined,
    linkedAccountId: linkedId,
    linkedAccountLabel: linkedId && accountLabels ? accountLabels.get(linkedId) : undefined,
  };
}

export function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** 사건 pending_amount 기준 미수금 청구서 자동 생성 (중복 방지) */
export async function syncOpenReceivablesFromCases(
  db: SupabaseClient,
  managementNumber: string
): Promise<number> {
  const { data: cases, error } = await db
    .from("cases")
    .select("id, case_number, client_name, pending_amount, status")
    .eq("management_number", managementNumber)
    .gt("pending_amount", 0);

  if (error || !cases?.length) return 0;

  const { data: existing } = await db
    .from("finance_entries")
    .select("case_id")
    .eq("management_number", managementNumber)
    .eq("entry_type", "미수금")
    .in("status", ["미확인", "확인"]);

  const openCaseIds = new Set((existing ?? []).map((r) => r.case_id).filter(Boolean));
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const c of cases) {
    const caseId = c.id as string;
    if (openCaseIds.has(caseId)) continue;
    const pending = Number(c.pending_amount ?? 0);
    if (pending <= 0) continue;

    const { error: insErr } = await db.from("finance_entries").insert({
      entry_type: "미수금",
      case_id: caseId,
      case_number: c.case_number ?? "",
      client_name: c.client_name ?? "(의뢰인 없음)",
      amount: pending,
      entry_date: today,
      description: "미수금 (사건 동기화)",
      status: "미확인",
      management_number: managementNumber,
    });
    if (!insErr) {
      created += 1;
      openCaseIds.add(caseId);
    }
  }

  return created;
}

export async function loadFinanceDashboard(
  db: SupabaseClient,
  managementNumber: string
): Promise<{
  transactions: BankTransaction[];
  entries: FinanceEntry[];
  stats: FinanceStats;
}> {
  const [{ data: txRows }, { data: entryRows }, { data: matchedRows }] = await Promise.all([
    db
      .from("bank_transactions")
      .select("*")
      .eq("management_number", managementNumber)
      .is("matched_finance_id", null)
      .order("transaction_date", { ascending: false }),
    db
      .from("finance_entries")
      .select("*")
      .eq("management_number", managementNumber)
      .eq("entry_type", "미수금")
      .in("status", ["미확인", "확인"])
      .order("entry_date", { ascending: false }),
    db
      .from("bank_transactions")
      .select("id")
      .eq("management_number", managementNumber)
      .not("matched_finance_id", "is", null),
  ]);

  const monthStart = monthStartIso();
  const { data: monthReceivedRows } = await db
    .from("finance_entries")
    .select("amount")
    .eq("management_number", managementNumber)
    .eq("entry_type", "수납")
    .gte("entry_date", monthStart);

  const { data: pendingSumRows } = await db
    .from("finance_entries")
    .select("amount")
    .eq("management_number", managementNumber)
    .eq("entry_type", "미수금")
    .in("status", ["미확인", "확인"]);

  const accounts = await loadLinkedAccounts(db, managementNumber);
  const accountLabels = new Map(accounts.map((a) => [a.id, linkedAccountLabel(a)]));
  const transactions = (txRows ?? []).map((r) =>
    mapBankTransactionRow(r as BankTransactionRow, accountLabels)
  );
  const entries = (entryRows ?? []).map((r) => mapFinanceEntryRow(r as FinanceEntryRow));

  const stats: FinanceStats = {
    monthlyReceived: (monthReceivedRows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0),
    totalPending: (pendingSumRows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0),
    matchedCount: matchedRows?.length ?? 0,
    pendingTransactionCount: transactions.length,
  };

  return { transactions, entries, stats };
}

/** 사건별 청구·수납 이력 */
export async function loadCaseFinanceHistory(
  db: SupabaseClient,
  caseId: string,
  managementNumber: string
): Promise<CaseFinanceHistory> {
  const { data: caseRow } = await db
    .from("cases")
    .select("amount, received_amount, pending_amount")
    .eq("id", caseId)
    .eq("management_number", managementNumber)
    .maybeSingle();

  const { data: rows } = await db
    .from("finance_entries")
    .select("*")
    .eq("case_id", caseId)
    .eq("management_number", managementNumber)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  const entries = (rows ?? []).map((r) => mapFinanceEntryRow(r as FinanceEntryRow));
  const receivables = entries.filter((e) => e.type === "미수금");
  const payments = entries.filter((e) => e.type === "수납");

  const billedTotal = receivables.reduce((s, e) => s + e.amount, 0);
  const openReceivableTotal = receivables
    .filter((e) => e.status === "미확인" || e.status === "확인")
    .reduce((s, e) => s + e.amount, 0);
  const paidFromEntries = payments.reduce((s, e) => s + e.amount, 0);

  const totalAmount = Math.max(Number(caseRow?.amount ?? 0), billedTotal);
  const receivedAmount = Math.max(Number(caseRow?.received_amount ?? 0), paidFromEntries);
  const pendingAmount =
    openReceivableTotal > 0
      ? openReceivableTotal
      : Math.max(0, Number(caseRow?.pending_amount ?? 0));

  return {
    receivables,
    payments,
    summary: {
      totalAmount,
      receivedAmount,
      pendingAmount,
      billedTotal,
      openReceivableTotal,
    },
  };
}

/** 청구(미수금) 등록 시 사건 금액 반영 */
export async function applyCaseBilling(
  db: SupabaseClient,
  caseId: string,
  billingAmount: number,
  managementNumber: string
): Promise<void> {
  const { data: caseRow, error } = await db
    .from("cases")
    .select("amount, received_amount, pending_amount")
    .eq("id", caseId)
    .eq("management_number", managementNumber)
    .maybeSingle();

  if (error || !caseRow) return;

  const amount = Math.max(Number(caseRow.amount ?? 0), Number(caseRow.received_amount ?? 0) + billingAmount);
  const pending = Number(caseRow.pending_amount ?? 0) + billingAmount;

  await db
    .from("cases")
    .update({
      amount,
      pending_amount: pending,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId)
    .eq("management_number", managementNumber);
}

export async function applyCasePayment(
  db: SupabaseClient,
  caseId: string,
  paymentAmount: number,
  managementNumber: string
): Promise<void> {
  const { data: caseRow, error } = await db
    .from("cases")
    .select("amount, received_amount, pending_amount")
    .eq("id", caseId)
    .eq("management_number", managementNumber)
    .maybeSingle();

  if (error || !caseRow) return;

  const received = Number(caseRow.received_amount ?? 0) + paymentAmount;
  const total = Number(caseRow.amount ?? 0);
  let pending = Math.max(0, Number(caseRow.pending_amount ?? 0) - paymentAmount);
  if (total > 0) {
    pending = Math.max(0, total - received);
  }

  await db
    .from("cases")
    .update({
      received_amount: received,
      pending_amount: pending,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId)
    .eq("management_number", managementNumber);
}

export type MatchPairInput = { transactionId: string; entryId: string };

export async function confirmFinanceMatches(
  db: SupabaseClient,
  managementNumber: string,
  pairs: MatchPairInput[],
  actorName?: string
): Promise<{ confirmed: number; errors: string[] }> {
  const errors: string[] = [];
  let confirmed = 0;
  const now = new Date().toISOString();

  for (const pair of pairs) {
    const txId = pair.transactionId?.trim();
    const entryId = pair.entryId?.trim();
    if (!txId || !entryId) {
      errors.push("transactionId/entryId 누락");
      continue;
    }

    const { data: tx, error: txErr } = await db
      .from("bank_transactions")
      .select("*")
      .eq("id", txId)
      .eq("management_number", managementNumber)
      .maybeSingle();

    if (txErr || !tx) {
      errors.push(`입금 ${txId}: 없음`);
      continue;
    }
    if (tx.matched_finance_id) {
      errors.push(`입금 ${txId}: 이미 매칭됨`);
      continue;
    }

    const { data: entry, error: entryErr } = await db
      .from("finance_entries")
      .select("*")
      .eq("id", entryId)
      .eq("management_number", managementNumber)
      .maybeSingle();

    if (entryErr || !entry) {
      errors.push(`청구 ${entryId}: 없음`);
      continue;
    }
    if (entry.status === "매칭완료") {
      errors.push(`청구 ${entryId}: 이미 완료`);
      continue;
    }

    const paymentAmount = Number(tx.amount ?? 0);
    const entryAmount = Number(entry.amount ?? 0);

    const { error: linkErr } = await db
      .from("bank_transactions")
      .update({
        matched_finance_id: entryId,
        confirmed_at: now,
      })
      .eq("id", txId)
      .eq("management_number", managementNumber);

    if (linkErr) {
      errors.push(`입금 ${txId}: ${linkErr.message}`);
      continue;
    }

    const { error: entryUpdErr } = await db
      .from("finance_entries")
      .update({
        status: "매칭완료",
        bank_transaction_id: txId,
        updated_at: now,
      })
      .eq("id", entryId)
      .eq("management_number", managementNumber);

    if (entryUpdErr) {
      errors.push(`청구 ${entryId}: ${entryUpdErr.message}`);
      await db
        .from("bank_transactions")
        .update({ matched_finance_id: null, confirmed_at: null })
        .eq("id", txId);
      continue;
    }

    await db.from("finance_entries").insert({
      entry_type: "수납",
      case_id: entry.case_id,
      case_number: entry.case_number,
      client_name: entry.client_name,
      amount: paymentAmount,
      entry_date: tx.transaction_date,
      description: `입금 매칭${actorName ? ` (${actorName})` : ""}`,
      status: "확인",
      bank_transaction_id: txId,
      management_number: managementNumber,
    });

    if (entry.case_id) {
      await applyCasePayment(db, entry.case_id as string, Math.min(paymentAmount, entryAmount), managementNumber);
    }

    confirmed += 1;
  }

  return { confirmed, errors };
}
