"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import type { BankTransaction, LinkedAccount } from "@/lib/types";
import { formatAmount, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AccountDetailResponse = {
  account?: LinkedAccount;
  label?: string;
  transactions?: BankTransaction[];
  error?: string;
};

export default function FinanceAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<LinkedAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);

  const fetchDetail = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/accounts/${accountId}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as AccountDetailResponse;
      if (!res.ok) {
        setError(data.error ?? "계좌 정보를 불러오지 못했습니다.");
        return;
      }
      setAccount(data.account ?? null);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const title = account?.displayName?.trim() || account?.bankName || "연동 계좌";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/finance">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />}>
            회계/수납
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
          <Loader2 size={20} className="animate-spin" />
          불러오는 중…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
      ) : account ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">{title}</h1>
                <p className="text-sm text-text-muted mt-0.5">
                  {account.bankName} · {account.accountNumberMasked}
                  {account.accountHolder ? ` · ${account.accountHolder}` : ""}
                </p>
                {account.balance != null && (
                  <p className="text-xl font-bold text-slate-900 mt-3 tabular-nums">
                    {formatAmount(account.balance)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">거래내역</h2>
              <span className="text-xs text-text-muted">{transactions.length}건</span>
            </div>
            {transactions.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-text-muted">거래내역이 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {transactions.map((tx) => (
                  <div key={tx.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800">{tx.depositorName}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {formatDate(tx.date)}
                        {tx.memo ? ` · ${tx.memo}` : ""}
                      </div>
                    </div>
                    <div className="font-bold tabular-nums text-success-700">{formatAmount(tx.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
