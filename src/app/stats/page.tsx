"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { FinanceStatsPayload } from "@/lib/financeBillingServer";
import { cn, formatAmount } from "@/lib/utils";
import { BarChart3, TrendingUp, FolderOpen, DollarSign, Award, Target, Loader2 } from "lucide-react";

const emptyStats: FinanceStatsPayload = {
  totalCases: 0,
  activeCases: 0,
  totalAmount: 0,
  totalReceived: 0,
  totalPending: 0,
  monthlyReceived: 0,
  monthlyRevenue: [],
  byType: {},
  byStatus: {},
  byStaff: {},
  staffFinance: [],
};

export default function StatsPage() {
  const [stats, setStats] = useState<FinanceStatsPayload>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/finance/stats", { credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as FinanceStatsPayload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "통계를 불러오지 못했습니다.");
          return;
        }
        if (!cancelled) setStats({ ...emptyStats, ...data });
      } catch {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxTypeVal = Math.max(1, ...Object.values(stats.byType));
  const maxRevenue = Math.max(1, ...stats.monthlyRevenue.map((d) => d.value));
  const statusColors: Record<string, string> = {
    진행중: "bg-primary-500",
    종결: "bg-slate-300",
    사임: "bg-slate-400",
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center gap-2 text-slate-500 min-h-[40vh]">
        <Loader2 size={20} className="animate-spin" />
        통계 불러오는 중…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">통계 / 분석</h1>
        <p className="text-sm text-text-muted mt-0.5">사건·수임료 실데이터 기반 대시보드</p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "전체 사건", value: `${stats.totalCases}건`, icon: <FolderOpen size={16} />, color: "text-primary-600", bg: "bg-primary-50" },
          { label: "진행 중", value: `${stats.activeCases}건`, icon: <TrendingUp size={16} />, color: "text-success-600", bg: "bg-success-50" },
          { label: "총 수임료", value: formatAmount(stats.totalAmount), icon: <DollarSign size={16} />, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "미수금 총액", value: formatAmount(stats.totalPending), icon: <BarChart3 size={16} />, color: "text-danger-600", bg: "bg-danger-50" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-card p-5"
          >
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", stat.bg)}>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className={cn("text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</div>
            <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-5">월별 수납 추이</h3>
        {stats.monthlyRevenue.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">수납 데이터가 없습니다.</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {stats.monthlyRevenue.map((d, i) => {
              const heightPct = (d.value / maxRevenue) * 100;
              const isCurrent = i === stats.monthlyRevenue.length - 1;
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="text-xs text-text-muted tabular-nums opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    {(d.value / 1000000).toFixed(1)}M
                  </div>
                  <div className="w-full relative" style={{ height: "120px" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
                      className={cn(
                        "absolute bottom-0 w-full rounded-t-lg",
                        isCurrent ? "bg-primary-600" : "bg-primary-200 group-hover:bg-primary-300 transition-colors"
                      )}
                    />
                  </div>
                  <div className={cn("text-xs font-medium", isCurrent ? "text-primary-600 font-bold" : "text-text-muted")}>
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 text-sm">
          <div>
            <span className="text-text-muted">이번 달 수납</span>
            <span className="font-bold text-success-600 ml-2 tabular-nums">{formatAmount(stats.monthlyReceived)}</span>
          </div>
          <div>
            <span className="text-text-muted">미수금</span>
            <span className="font-bold text-danger-600 ml-2 tabular-nums">{formatAmount(stats.totalPending)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">사건 종류별</h3>
          <div className="space-y-3">
            {Object.entries(stats.byType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-12 flex-shrink-0 truncate">{type}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxTypeVal) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="h-full bg-primary-500 rounded-full"
                  />
                </div>
                <span className="text-sm font-bold text-slate-800 w-8 tabular-nums text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">진행 상태별</h3>
          <div className="space-y-3">
            {["진행중", "종결", "사임"].map((status) => {
              const count = stats.byStatus[status] ?? 0;
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full flex-shrink-0", statusColors[status])} />
                    <span className="text-sm text-slate-700">{status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.totalCases ? (count / stats.totalCases) * 100 : 0}%` }}
                        transition={{ duration: 0.5 }}
                        className={cn("h-full rounded-full", statusColors[status])}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-800 tabular-nums w-8 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">담당자별 수납</h3>
          <div className="space-y-3">
            {stats.staffFinance.slice(0, 8).map((row, i) => (
              <div key={row.staff} className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    i === 0 ? "bg-warning-400 text-white" : "bg-slate-200 text-slate-600"
                  )}
                >
                  {i === 0 ? <Award size={11} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700 truncate">{row.staff}</div>
                  <div className="text-[10px] text-text-muted">{row.caseCount}건 · 미수 {formatAmount(row.pending)}</div>
                </div>
                <span className="text-xs font-bold text-success-700 tabular-nums">{formatAmount(row.received)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Target size={12} />
              담당자별 수납·미수는 사건 요약 금액 기준입니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
