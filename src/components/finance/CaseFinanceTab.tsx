"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  DollarSign,
  FileCheck,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { BillingItem } from "@/lib/financeBillingServer";
import type { CaseItem, FinanceEntry } from "@/lib/types";
import type { CaseFinanceSummary } from "@/lib/financeServer";
import { cn, formatAmount, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { FinanceCaseBillingForm } from "@/components/finance/FinanceCaseBillingForm";

type CaseFinanceResponse = {
  receivables?: FinanceEntry[];
  payments?: FinanceEntry[];
  summary?: CaseFinanceSummary;
  amount?: number;
  receivedAmount?: number;
  pendingAmount?: number;
  error?: string;
};

type Props = {
  caseItem: CaseItem;
  onCaseUpdated?: () => void;
};

function statusLabel(status: FinanceEntry["status"]) {
  if (status === "매칭완료") return { text: "수납완료", className: "bg-success-100 text-success-700" };
  if (status === "확인") return { text: "확인", className: "bg-slate-100 text-slate-600" };
  return { text: "미확인", className: "bg-warning-100 text-warning-700" };
}

export function CaseFinanceTab({ caseItem, onCaseUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receivables, setReceivables] = useState<FinanceEntry[]>([]);
  const [payments, setPayments] = useState<FinanceEntry[]>([]);
  const [summary, setSummary] = useState<CaseFinanceSummary | null>(null);
  const [formMode, setFormMode] = useState<"billing" | "receipt" | null>(null);
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/cases/${caseItem.id}?sync=1`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as CaseFinanceResponse;
      if (!res.ok) {
        setError(data.error ?? "수납 이력을 불러오지 못했습니다.");
        return;
      }
      setReceivables(Array.isArray(data.receivables) ? data.receivables : []);
      setPayments(Array.isArray(data.payments) ? data.payments : []);
      setSummary(data.summary ?? null);
    } catch {
      setError("네트워크 오류로 수납 이력을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [caseItem.id]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetch("/api/finance/billing-items", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { items?: BillingItem[] }) => setBillingItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setBillingItems([]));
  }, []);

  const totalAmount = summary?.totalAmount ?? caseItem.amount;
  const receivedAmount = summary?.receivedAmount ?? caseItem.receivedAmount;
  const pendingAmount = summary?.pendingAmount ?? caseItem.pendingAmount;
  const progress = totalAmount > 0 ? Math.round((receivedAmount / totalAmount) * 100) : 0;

  const submitEntry = async (
    mode: "billing" | "receipt",
    payload: { amount: number; description: string; date: string; billingItemId?: string }
  ) => {
    const res = await fetch("/api/finance/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        caseId: caseItem.id,
        caseNumber: caseItem.caseNumber,
        clientName: caseItem.clientName,
        amount: payload.amount,
        description: payload.description,
        date: payload.date,
        billingItemId: payload.billingItemId,
        type: mode === "billing" ? "미수금" : "수납",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "등록에 실패했습니다.");
      throw new Error(data.error);
    }
    toast.success(mode === "billing" ? "청구가 등록되었습니다." : "수납이 등록되었습니다.");
    await fetchHistory();
    onCaseUpdated?.();
  };

  return (
    <div className="max-w-3xl mx-auto px-5 py-5 space-y-4">
      <FinanceCaseBillingForm
        open={formMode !== null}
        mode={formMode ?? "billing"}
        billingItems={billingItems}
        onClose={() => setFormMode(null)}
        onSubmit={(data) => submitEntry(formMode ?? "billing", data)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">수임료 · 청구 · 수납</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={() => fetchHistory()}
            disabled={loading}
          >
            새로고침
          </Button>
          <Button size="sm" variant="outline" leftIcon={<Plus size={13} />} onClick={() => setFormMode("billing")}>
            청구 등록
          </Button>
          <Button size="sm" variant="outline" leftIcon={<DollarSign size={13} />} onClick={() => setFormMode("receipt")}>
            수동 수납
          </Button>
          <Link href="/finance">
            <Button size="sm" leftIcon={<ArrowRight size={13} />}>
              입금 매칭
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-slate-700">수납 진행률</span>
            <span className="font-bold text-slate-900">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-success-500 rounded-full"
            />
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "총 수임료", value: formatAmount(totalAmount), color: "text-slate-900" },
            { label: "수납 완료", value: formatAmount(receivedAmount), color: "text-success-700" },
            {
              label: "미수금",
              value: formatAmount(pendingAmount),
              color: pendingAmount > 0 ? "text-danger-700" : "text-success-600",
            },
          ].map((row) => (
            <div key={row.label} className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs text-text-muted">{row.label}</div>
              <div className={cn("text-sm font-bold tabular-nums mt-0.5", row.color)}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      {pendingAmount > 0 && (
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-danger-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-danger-800">
              미수금 {formatAmount(pendingAmount)} 미처리
            </div>
            <p className="text-xs text-danger-600 mt-0.5">
              회계/수납 화면에서 통장 입금과 매칭하거나, 수동 수납으로 바로 반영할 수 있습니다.
            </p>
          </div>
          <Link href="/finance">
            <Button size="xs" variant="danger">
              매칭하기
            </Button>
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2 text-sm">
          <Loader2 size={18} className="animate-spin" />
          수납 이력 불러오는 중…
        </div>
      ) : (
        <div className="space-y-4">
          <FinanceEntryTable
            title="청구 · 미수"
            entries={receivables}
            emptyText="등록된 청구가 없습니다."
            caseItem={caseItem}
          />
          <FinanceEntryTable title="수납 이력" entries={payments} emptyText="수납 이력이 없습니다." />
        </div>
      )}
    </div>
  );
}

function FinanceEntryTable({
  title,
  entries,
  emptyText,
  caseItem,
}: {
  title: string;
  entries: FinanceEntry[];
  emptyText: string;
  caseItem?: CaseItem;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <span className="text-xs text-text-muted">{entries.length}건</span>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">{emptyText}</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {entries.map((entry) => {
            const badge = statusLabel(entry.status);
            return (
              <div key={entry.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">
                    {entry.description || entry.type}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">{formatDate(entry.date)}</div>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", badge.className)}>
                  {badge.text}
                </span>
                <span className="font-bold tabular-nums text-slate-900 shrink-0">
                  {formatAmount(entry.amount)}
                </span>
                {caseItem && entry.status === "미확인" && entry.type === "미수금" && (
                  <Link
                    href={`/approval/draft?type=청구서&caseId=${caseItem.id}&caseNumber=${encodeURIComponent(caseItem.caseNumber)}&amount=${entry.amount}&financeEntryId=${entry.id}`}
                    className="shrink-0"
                  >
                    <Button size="xs" variant="outline" leftIcon={<FileCheck size={11} />}>
                      결재
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
