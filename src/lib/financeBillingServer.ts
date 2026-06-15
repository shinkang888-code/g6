/**
 * Phase 3~5 — 청구항목·반복청구·통계·세금·결재 연동
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCaseBilling } from "@/lib/financeServer";

export type BillingItem = {
  id: string;
  name: string;
  sortOrder: number;
  defaultAmount?: number;
  isRecurring: boolean;
  recurringDay?: number;
  active: boolean;
};

export type FinanceStatsPayload = {
  totalCases: number;
  activeCases: number;
  totalAmount: number;
  totalReceived: number;
  totalPending: number;
  monthlyReceived: number;
  monthlyRevenue: { month: string; label: string; value: number }[];
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byStaff: Record<string, number>;
  staffFinance: { staff: string; received: number; pending: number; caseCount: number }[];
};

const DEFAULT_BILLING_NAMES = ["착수금", "2차 착수금", "잔여 수임료", "성공보수", "실비"];

function billingFromRow(r: Record<string, unknown>): BillingItem {
  return {
    id: String(r.id),
    name: String(r.name),
    sortOrder: Number(r.sort_order ?? 0),
    defaultAmount: r.default_amount != null ? Number(r.default_amount) : undefined,
    isRecurring: Boolean(r.is_recurring),
    recurringDay: r.recurring_day != null ? Number(r.recurring_day) : undefined,
    active: r.active !== false,
  };
}

export async function ensureDefaultBillingItems(
  db: SupabaseClient,
  managementNumber: string
): Promise<void> {
  const { count } = await db
    .from("billing_items")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber);

  if ((count ?? 0) > 0) return;

  const rows = DEFAULT_BILLING_NAMES.map((name, i) => ({
    management_number: managementNumber,
    name,
    sort_order: i,
    active: true,
  }));
  await db.from("billing_items").insert(rows);
}

export async function loadBillingItems(
  db: SupabaseClient,
  managementNumber: string
): Promise<BillingItem[]> {
  await ensureDefaultBillingItems(db, managementNumber);
  const { data } = await db
    .from("billing_items")
    .select("*")
    .eq("management_number", managementNumber)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => billingFromRow(r as Record<string, unknown>));
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [, m] = key.split("-");
  return `${Number(m)}월`;
}

export async function loadFinanceStats(
  db: SupabaseClient,
  managementNumber: string
): Promise<FinanceStatsPayload> {
  const [{ data: cases }, { data: payments }] = await Promise.all([
    db
      .from("cases")
      .select("case_type, status, assigned_staff_name, amount, received_amount, pending_amount")
      .eq("management_number", managementNumber),
    db
      .from("finance_entries")
      .select("amount, entry_date")
      .eq("management_number", managementNumber)
      .eq("entry_type", "수납")
      .eq("status", "확인"),
  ]);

  const rows = cases ?? [];
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byStaff: Record<string, number> = {};
  const staffFinanceMap = new Map<string, { received: number; pending: number; caseCount: number }>();

  let totalAmount = 0;
  let totalReceived = 0;
  let totalPending = 0;
  let activeCases = 0;

  for (const c of rows) {
    const type = String(c.case_type ?? "기타") || "기타";
    const status = String(c.status ?? "진행중");
    const staff = String(c.assigned_staff_name ?? "미지정") || "미지정";
    byType[type] = (byType[type] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    byStaff[staff] = (byStaff[staff] ?? 0) + 1;
    if (status === "진행중") activeCases += 1;

    const amt = Number(c.amount ?? 0);
    const rec = Number(c.received_amount ?? 0);
    const pen = Number(c.pending_amount ?? 0);
    totalAmount += amt;
    totalReceived += rec;
    totalPending += pen;

    const prev = staffFinanceMap.get(staff) ?? { received: 0, pending: 0, caseCount: 0 };
    staffFinanceMap.set(staff, {
      received: prev.received + rec,
      pending: prev.pending + pen,
      caseCount: prev.caseCount + 1,
    });
  }

  const now = new Date();
  const monthBuckets = new Map<string, number>();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.set(monthKey(d), 0);
  }

  for (const p of payments ?? []) {
    const key = String(p.entry_date ?? "").slice(0, 7);
    if (monthBuckets.has(key)) {
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + Number(p.amount ?? 0));
    }
  }

  const currentKey = monthKey(now);
  const monthlyReceived = monthBuckets.get(currentKey) ?? 0;
  const monthlyRevenue = [...monthBuckets.entries()].map(([month, value]) => ({
    month,
    label: monthLabel(month),
    value,
  }));

  const staffFinance = [...staffFinanceMap.entries()]
    .map(([staff, v]) => ({ staff, ...v }))
    .sort((a, b) => b.received - a.received);

  return {
    totalCases: rows.length,
    activeCases,
    totalAmount,
    totalReceived,
    totalPending,
    monthlyReceived,
    monthlyRevenue,
    byType,
    byStatus,
    byStaff,
    staffFinance,
  };
}

export async function runDueBillingSchedules(
  db: SupabaseClient,
  managementNumber: string
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: schedules } = await db
    .from("billing_schedules")
    .select("*, cases(case_number, client_name)")
    .eq("management_number", managementNumber)
    .eq("active", true)
    .lte("next_bill_date", today);

  let created = 0;
  for (const s of schedules ?? []) {
    const caseId = s.case_id as string;
    const caseRow = s.cases as { case_number?: string; client_name?: string } | null;
    const amount = Number(s.amount ?? 0);
    if (!caseId || amount <= 0) continue;

    const { error: insErr } = await db.from("finance_entries").insert({
      entry_type: "미수금",
      case_id: caseId,
      case_number: caseRow?.case_number ?? "",
      client_name: caseRow?.client_name ?? "(의뢰인 없음)",
      amount,
      entry_date: today,
      description: (s.description as string) || "반복 청구",
      status: "미확인",
      billing_item_id: s.billing_item_id,
      management_number: managementNumber,
    });
    if (insErr) continue;

    await applyCaseBilling(db, caseId, amount, managementNumber);

    const next = new Date(String(s.next_bill_date));
    next.setMonth(next.getMonth() + Number(s.interval_months ?? 1));
    await db
      .from("billing_schedules")
      .update({
        next_bill_date: next.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", s.id);

    created += 1;
  }
  return created;
}

export async function onApprovalFinanceComplete(
  db: SupabaseClient,
  approvalId: string,
  managementNumber: string
): Promise<void> {
  const { data: approval } = await db
    .from("approvals")
    .select("id, doc_type, finance_entry_id, case_id, amount, status")
    .eq("id", approvalId)
    .maybeSingle();

  if (!approval || approval.doc_type !== "청구서" || approval.status !== "결재완료") return;

  const entryId = approval.finance_entry_id as string | null;
  if (!entryId) return;

  await db
    .from("finance_entries")
    .update({ status: "확인", updated_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("management_number", managementNumber);
}
