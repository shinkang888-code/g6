"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  ScanLine,
  Activity,
  Lock,
  RefreshCw,
  Server,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SecurityModuleStatus } from "@/lib/security/securityModulesCatalog";

type ModuleRow = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  source: string;
  status: SecurityModuleStatus;
};

type Summary = {
  total: number;
  last24h: number;
  last7d: number;
  unresolved: number;
  bySource: { source: string; count: number }[];
  topIps: { ip: string; count: number }[];
  severityCounts: Record<string, number>;
};

type OverviewData = {
  active: boolean;
  label: string;
  socLogging: boolean;
  modules: ModuleRow[];
  headers: string[];
  protectedApiCount: number;
  summary: Summary;
  viewer: { loginId: string; name: string; role?: string };
};

const STATUS_DOT: Record<SecurityModuleStatus, string> = {
  active: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
  standby: "bg-amber-400",
  offline: "bg-slate-500",
};

const SOURCE_LABEL: Record<string, string> = {
  auth: "인증",
  api: "API",
  admin: "관리자",
  ai: "AI",
  upload: "업로드",
  scan: "접속점검",
  rule: "규칙",
};

export default function SecurityOverviewPanel({
  onOpenLogs,
}: {
  onOpenLogs?: (preset?: { hours?: number; unresolved?: boolean }) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security/overview", { credentials: "include" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      await fetch("/api/admin/security/scan", { method: "POST", credentials: "include" });
      await load();
    } finally {
      setScanning(false);
    }
  };

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-[#0A1628] text-slate-100 p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield size={28} className="text-primary-400" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">LSCC 보안 콘솔</h2>
              <p className="text-xs text-slate-400">LawyGo Security Command Center</p>
              {data?.viewer && (
                <p className="text-[11px] text-primary-300 mt-1">
                  관리자: {data.viewer.name} ({data.viewer.loginId})
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
              leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
              onClick={() => void load()}
              disabled={loading}
            >
              새로고침
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
              leftIcon={<ScanLine size={14} />}
              loading={scanning}
              onClick={() => void runScan()}
            >
              접속 환경 점검
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Activity size={14} className="text-emerald-400" />
          <span className="text-sm text-emerald-300">{loading ? "상태 확인 중…" : data?.label}</span>
        </div>

        {summary && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "전체 로그", value: summary.total, icon: Server },
              { label: "24시간", value: summary.last24h, icon: Globe, onClick: () => onOpenLogs?.({ hours: 24 }) },
              { label: "7일", value: summary.last7d, icon: Globe, onClick: () => onOpenLogs?.({ hours: 168 }) },
              {
                label: "미처리",
                value: summary.unresolved,
                icon: AlertTriangle,
                onClick: () => onOpenLogs?.({ unresolved: true }),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-left transition-colors",
                  item.onClick && "hover:bg-white/10 cursor-pointer"
                )}
              >
                <item.icon size={14} className="text-slate-400 mb-1" />
                <p className="text-xl font-bold text-white">{item.value}</p>
                <p className="text-[10px] text-slate-400">{item.label}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Shield size={16} className="text-primary-600" />
                보안 모듈 ({data.modules.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.modules.map((mod) => (
                  <div key={mod.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("size-1.5 rounded-full", STATUS_DOT[mod.status])} />
                      <span className="text-sm font-medium text-slate-900">{mod.name}</span>
                      <span className="text-[10px] font-mono text-primary-600 ml-auto">{mod.shortName}</span>
                    </div>
                    <p className="text-xs text-slate-500">{mod.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
                <h3 className="font-semibold text-slate-900 mb-3">소스별 접속·이벤트</h3>
                {summary?.bySource.length ? (
                  <ul className="space-y-2">
                    {summary.bySource.map((s) => (
                      <li key={s.source} className="flex justify-between text-sm">
                        <span className="text-slate-600">{SOURCE_LABEL[s.source] ?? s.source}</span>
                        <span className="font-semibold text-slate-900">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted text-center py-4">기록된 이벤트가 없습니다.</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
                <h3 className="font-semibold text-slate-900 mb-3">상위 접속 IP</h3>
                {summary?.topIps.length ? (
                  <ul className="space-y-2">
                    {summary.topIps.map((row) => (
                      <li key={row.ip} className="flex justify-between text-sm font-mono">
                        <span className="text-slate-600 truncate pr-2">{row.ip}</span>
                        <span className="font-semibold text-slate-900 shrink-0">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted text-center py-4">IP 데이터 없음</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={16} className="text-primary-600" />
              <h3 className="font-semibold text-slate-900">HTTP 보안 헤더 · 보호 API {data.protectedApiCount}+</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.headers.map((h) => (
                <span
                  key={h}
                  className="text-[10px] font-mono px-2 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-100"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
