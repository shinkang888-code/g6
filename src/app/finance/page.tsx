"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  CreditCard,
  ArrowRight,
  Check,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Link2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn, formatDate, formatAmount } from "@/lib/utils";
import type { BankTransaction, FinanceEntry, LinkedAccount } from "@/lib/types";
import type { FinanceStats } from "@/lib/financeServer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportFinanceLedgerExcel, exportFinanceSearchResult } from "@/lib/listExcelExports";
import { FinanceTaxDocuments } from "@/components/finance/FinanceTaxDocuments";
import { FinanceDepositForm } from "@/components/finance/FinanceDepositForm";
import { FinanceLinkedAccounts } from "@/components/finance/FinanceLinkedAccounts";
import { FinanceAccountLinkForm } from "@/components/finance/FinanceAccountLinkForm";

type MatchPair = { transactionId: string; entryId: string };

type FinanceApiResponse = {
  transactions?: BankTransaction[];
  entries?: FinanceEntry[];
  stats?: FinanceStats;
  managementNumber?: string;
  syncedReceivables?: number;
  accounts?: LinkedAccount[];
  error?: string;
};

const emptyStats: FinanceStats = {
  monthlyReceived: 0,
  totalPending: 0,
  matchedCount: 0,
  pendingTransactionCount: 0,
};

export default function FinancePage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [stats, setStats] = useState<FinanceStats>(emptyStats);
  const [managementNumber, setManagementNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<MatchPair[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [justMatched, setJustMatched] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [accountLinkOpen, setAccountLinkOpen] = useState(false);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);

  const applyPayload = useCallback((data: FinanceApiResponse) => {
    setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    setEntries(Array.isArray(data.entries) ? data.entries : []);
    setStats(data.stats ?? emptyStats);
    setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    if (data.managementNumber) setManagementNumber(data.managementNumber);
  }, []);

  const fetchFinance = useCallback(async (sync = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance?sync=${sync ? "1" : "0"}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as FinanceApiResponse;
      if (!res.ok) {
        setError(data.error ?? "회계 데이터를 불러오지 못했습니다.");
        return;
      }
      applyPayload(data);
      if (data.syncedReceivables && data.syncedReceivables > 0) {
        toast.success(`사건 미수금 ${data.syncedReceivables}건을 청구 목록에 반영했습니다.`);
      }
    } catch {
      setError("네트워크 오류로 회계 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void fetchFinance(true);
  }, [fetchFinance]);

  const handleMatch = (transactionId: string, entryId: string) => {
    const alreadyMatched = matched.find(
      (m) => m.transactionId === transactionId || m.entryId === entryId
    );
    if (alreadyMatched) return;

    setMatched((prev) => [...prev, { transactionId, entryId }]);
    setJustMatched(`${transactionId}-${entryId}`);
    setTimeout(() => setJustMatched(null), 2000);

    toast.success("매칭 목록에 추가했습니다.", {
      description: "하단 「전체 확정」으로 DB에 반영하세요.",
    });
  };

  const handleConfirmAll = async () => {
    if (matched.length === 0) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/finance/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pairs: matched }),
      });
      const data = (await res.json().catch(() => ({}))) as FinanceApiResponse & {
        confirmed?: number;
        errors?: string[];
      };
      if (!res.ok) {
        toast.error(data.error ?? "수납 확정에 실패했습니다.");
        return;
      }
      applyPayload(data);
      setMatched([]);
      const n = data.confirmed ?? matched.length;
      toast.success(`${n}건 수납 처리가 완료되었습니다.`);
      if (data.errors?.length) {
        toast.error(data.errors.slice(0, 2).join(" · "));
      }
    } catch {
      toast.error("수납 확정 요청 중 오류가 발생했습니다.");
    } finally {
      setConfirming(false);
    }
  };

  const handleDepositSubmit = async (payload: {
    depositorName: string;
    amount: number;
    bankName: string;
    memo: string;
    date: string;
    linkedAccountId?: string;
  }) => {
    const res = await fetch("/api/finance/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "입금 등록에 실패했습니다.");
      throw new Error(data.error);
    }
    toast.success("입금 내역이 등록되었습니다.");
    await fetchFinance(false);
  };

  const isTransactionMatched = (id: string) => matched.some((m) => m.transactionId === id);
  const isEntryMatched = (id: string) => matched.some((m) => m.entryId === id);

  const getMatchedEntry = (transactionId: string) => {
    const pair = matched.find((m) => m.transactionId === transactionId);
    if (!pair) return null;
    return entries.find((e) => e.id === pair.entryId) ?? null;
  };

  const getFuzzyScore = (transaction: BankTransaction, entry: FinanceEntry): number => {
    const tName = transaction.depositorName.replace(/\s/g, "").toLowerCase();
    const eName = entry.clientName.replace(/\s/g, "").toLowerCase();
    const nameMatch = tName.includes(eName) || eName.includes(tName) ? 1 : 0;
    const amountMatch = Math.abs(transaction.amount - entry.amount) < 100000 ? 1 : 0;
    return nameMatch * 0.6 + amountMatch * 0.4;
  };

  const isFuzzyMatch = (transaction: BankTransaction, entry: FinanceEntry): boolean => {
    return getFuzzyScore(transaction, entry) >= 0.5;
  };

  const unmatchedTx = transactions.filter((t) => !isTransactionMatched(t.id));
  const unmatchedEntries = entries.filter((e) => !isEntryMatched(e.id));

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      <FinanceDepositForm
        open={depositOpen}
        accounts={accounts}
        onClose={() => setDepositOpen(false)}
        onSubmit={handleDepositSubmit}
      />
      <FinanceAccountLinkForm
        open={accountLinkOpen}
        onClose={() => setAccountLinkOpen(false)}
        onSubmit={async (data) => {
          const res = await fetch("/api/finance/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast.error(json.error ?? "계좌 연결에 실패했습니다.");
            throw new Error(json.error);
          }
          toast.success("계좌가 연결되었습니다.");
          await fetchFinance(false);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">회계 / 수납 관리</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {managementNumber ? `회사코드 ${managementNumber} · ` : ""}
            미매칭 입금 <span className="text-danger-600 font-semibold">{unmatchedTx.length}건</span>
            &nbsp;·&nbsp;
            미수금 <span className="text-warning-600 font-semibold">{unmatchedEntries.length}건</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={() => fetchFinance(true)}
            disabled={loading}
          >
            새로고침
          </Button>
          <SearchResultExcelButton
            count={transactions.length + entries.length}
            onExport={() => {
              const total = transactions.length + entries.length;
              if (exportFinanceSearchResult(transactions, entries)) {
                toast.success(`${total}건을 엑셀로보냈습니다.`);
              }
            }}
          />
          <Link href="/stats">
            <Button variant="outline" size="sm" leftIcon={<TrendingUp size={13} />}>
              통계 보기
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const ok = await exportFinanceLedgerExcel();
              toast[ok ? "success" : "error"](ok ? "수납대장을 엑셀로보냈습니다." : "수납대장보내기에 실패했습니다.");
            }}
          >
            수납대장
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch("/api/finance/billing-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action: "run-recurring" }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) toast.error(data.error ?? "반복 청구 실행 실패");
              else {
                toast.success(`반복 청구 ${data.createdSchedules ?? 0}건 처리`);
                await fetchFinance(true);
              }
            }}
          >
            반복청구
          </Button>
          <Button size="sm" leftIcon={<DollarSign size={13} />} onClick={() => setDepositOpen(true)}>
            입금 등록
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            <p className="text-xs mt-1 text-amber-700">
              Supabase 마이그레이션(20260614000000_finance_tenant_scope.sql) 적용 여부를 확인하세요.
            </p>
          </div>
        </div>
      )}

      <FinanceLinkedAccounts accounts={accounts} onAddClick={() => setAccountLinkOpen(true)} />

      <FinanceTaxDocuments />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "이번 달 수납", value: formatAmount(stats.monthlyReceived), color: "text-success-600", bg: "bg-success-50" },
          { label: "미수금 총액", value: formatAmount(stats.totalPending), color: "text-danger-600", bg: "bg-danger-50" },
          { label: "매칭 완료(누적)", value: `${stats.matchedCount}건`, color: "text-primary-600", bg: "bg-primary-50" },
          { label: "처리 대기", value: `${stats.pendingTransactionCount}건`, color: "text-warning-600", bg: "bg-warning-50" },
        ].map((stat) => (
          <div key={stat.label} className={cn("rounded-xl p-4 border border-transparent", stat.bg)}>
            <div className={cn("text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</div>
            <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
          <Loader2 size={20} className="animate-spin" />
          회계 데이터 불러오는 중…
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <Link2 size={16} className="text-primary-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">수납 매칭 인터페이스</h3>
              <p className="text-xs text-text-muted mt-0.5">
                입금 내역을 청구서로 드래그한 뒤 하단에서 확정하세요.
                <span className="text-primary-600 font-medium ml-1">파란색 = 추천 매칭</span>
              </p>
            </div>
          </div>

          <div className="p-5">
            {transactions.length === 0 && entries.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-muted space-y-2">
                <CreditCard size={32} className="mx-auto text-slate-300" />
                <p>미매칭 입금·미수금이 없습니다.</p>
                <p className="text-xs">사건에 미수금이 있으면 새로고침 시 청구 목록에 자동 반영됩니다.</p>
                <Button size="sm" variant="outline" onClick={() => setDepositOpen(true)}>
                  입금 등록
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-success-500" />
                    <span className="text-sm font-semibold text-slate-700">미확인 입금 내역</span>
                    <span className="text-xs text-text-muted bg-slate-100 rounded-full px-2 py-0.5">
                      {unmatchedTx.length}건
                    </span>
                  </div>
                  <div className="space-y-3">
                    {unmatchedTx.length === 0 ? (
                      <p className="text-xs text-text-muted py-4">미확인 입금이 없습니다.</p>
                    ) : (
                      unmatchedTx.map((t) => {
                        const matched_ = isTransactionMatched(t.id);
                        const matchedEntry = getMatchedEntry(t.id);
                        return (
                          <motion.div
                            key={t.id}
                            layout
                            draggable={!matched_}
                            onDragStart={() => setDraggingId(t.id)}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverId(null);
                            }}
                            className={cn(
                              "rounded-xl border p-4 transition-all duration-200",
                              matched_
                                ? "border-success-200 bg-success-50 opacity-70"
                                : "border-slate-200 bg-white cursor-grab active:cursor-grabbing",
                              !matched_ && "hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5",
                              draggingId === t.id && "shadow-xl rotate-1 border-primary-400 z-10"
                            )}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="text-sm font-bold text-slate-900">{formatAmount(t.amount)}</div>
                                <div className="text-sm font-medium text-slate-700 mt-0.5">{t.depositorName}</div>
                                {t.linkedAccountLabel && (
                                  <div className="text-[11px] text-primary-600 mt-0.5">{t.linkedAccountLabel}</div>
                                )}
                              </div>
                              {matched_ ? (
                                <div className="flex items-center gap-1 text-xs text-success-700 font-medium bg-success-100 rounded-full px-2 py-0.5">
                                  <Check size={11} /> 매칭 대기
                                </div>
                              ) : (
                                <span className="text-xs text-text-muted">{t.bankName}</span>
                              )}
                            </div>
                            <div className="text-xs text-text-muted">
                              {formatDate(t.date)} · {t.memo}
                            </div>
                            {matched_ && matchedEntry && (
                              <div className="mt-2 pt-2 border-t border-success-200 text-xs text-success-700 font-medium">
                                → {matchedEntry.clientName} / {matchedEntry.caseNumber}
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-warning-500" />
                    <span className="text-sm font-semibold text-slate-700">미수금 청구서</span>
                    <span className="text-xs text-text-muted bg-slate-100 rounded-full px-2 py-0.5">
                      {unmatchedEntries.length}건
                    </span>
                  </div>
                  <div className="space-y-3">
                    {unmatchedEntries.length === 0 ? (
                      <p className="text-xs text-text-muted py-4">미수금 청구가 없습니다.</p>
                    ) : (
                      unmatchedEntries.map((entry) => {
                        const isMatched_ = isEntryMatched(entry.id);
                        const isDragTarget = dragOverId === entry.id;
                        const hasFuzzyMatch =
                          !isMatched_ &&
                          transactions.some(
                            (t) => !isTransactionMatched(t.id) && isFuzzyMatch(t, entry)
                          );

                        return (
                          <motion.div
                            key={entry.id}
                            layout
                            animate={
                              justMatched &&
                              matched.find(
                                (m) => m.entryId === entry.id && justMatched.includes(entry.id)
                              )
                                ? { scale: [1, 1.05, 1] }
                                : {}
                            }
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverId(entry.id);
                            }}
                            onDragLeave={() => setDragOverId(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggingId && !isMatched_) {
                                handleMatch(draggingId, entry.id);
                              }
                              setDragOverId(null);
                            }}
                            onClick={() => {
                              if (draggingId && !isMatched_) {
                                handleMatch(draggingId, entry.id);
                              }
                            }}
                            className={cn(
                              "rounded-xl border p-4 transition-all duration-200 relative overflow-hidden",
                              isMatched_
                                ? "border-success-200 bg-success-50 opacity-70"
                                : isDragTarget
                                  ? "border-primary-400 bg-primary-50 scale-[1.02] shadow-primary-glow"
                                  : hasFuzzyMatch
                                    ? "border-primary-300 bg-primary-50/50 shadow-sm"
                                    : "border-slate-200 bg-white",
                              !isMatched_ && draggingId && "cursor-pointer"
                            )}
                          >
                              {hasFuzzyMatch && !isMatched_ && (
                                <div
                                  className="absolute inset-0 rounded-xl border-2 border-primary-400 opacity-0 animate-ping pointer-events-none"
                                  style={{ animationDuration: "2s" }}
                                />
                              )}
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="text-sm font-bold text-slate-900">
                                    {formatAmount(entry.amount)}
                                  </div>
                                  <div className="text-sm font-medium text-slate-700 mt-0.5">
                                    {entry.clientName}
                                  </div>
                                </div>
                                {isMatched_ ? (
                                  <div className="flex items-center gap-1 text-xs text-success-700 font-medium bg-success-100 rounded-full px-2 py-0.5">
                                    <Check size={11} /> 매칭 대기
                                  </div>
                                ) : hasFuzzyMatch ? (
                                  <span className="text-xs text-primary-600 font-medium bg-primary-100 rounded-full px-2 py-0.5 animate-pulse">
                                    추천
                                  </span>
                                ) : (
                                  <span className="text-xs text-warning-600 font-medium bg-warning-100 rounded-full px-2 py-0.5">
                                    미수금
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-text-muted">
                                {entry.caseNumber} · {entry.description}
                              </div>
                              <div className="text-xs text-text-muted mt-0.5">
                                청구일: {formatDate(entry.date)}
                              </div>
                              {isDragTarget && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="absolute inset-0 bg-primary-600/5 rounded-xl flex items-center justify-center"
                                >
                                  <div className="bg-primary-600 text-white text-xs font-bold rounded-full px-3 py-1.5 shadow-lg">
                                    여기에 드롭하여 매칭
                                  </div>
                                </motion.div>
                              )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {matched.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 pt-6 border-t border-slate-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">
                    매칭 대기 ({matched.length}건)
                  </h4>
                  <Button
                    variant="success"
                    size="sm"
                    leftIcon={
                      confirming ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Check size={13} />
                      )
                    }
                    onClick={() => void handleConfirmAll()}
                    disabled={confirming}
                    loading={confirming}
                  >
                    전체 확정
                  </Button>
                </div>
                <div className="space-y-2">
                  {matched.map((pair) => {
                    const t = transactions.find((tx) => tx.id === pair.transactionId);
                    const e = entries.find((en) => en.id === pair.entryId);
                    if (!t || !e) return null;
                    return (
                      <div
                        key={`${pair.transactionId}-${pair.entryId}`}
                        className="flex items-center gap-3 p-3 bg-success-50 border border-success-200 rounded-xl"
                      >
                        <div className="text-sm font-medium text-slate-800">{t.depositorName}</div>
                        <ArrowRight size={14} className="text-success-500 flex-shrink-0" />
                        <div className="text-sm font-medium text-slate-800">
                          {e.clientName} ({e.caseNumber})
                        </div>
                        <div className="ml-auto text-sm font-bold text-success-700 tabular-nums">
                          {formatAmount(t.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
