"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, RefreshCw, ScanLine, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SecurityEventRow, AttackTypeStat } from "@/lib/security/securityEventTypes";

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-100 text-slate-700",
};

const CHART_COLORS = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#C9CBCF"];

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export default function SecurityDashboard({ embedded = false }: { embedded?: boolean }) {
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<AttackTypeStat[]>([]);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, stRes] = await Promise.all([
        fetch("/api/admin/security/events?page_size=50", { credentials: "include" }),
        fetch("/api/admin/security/stats", { credentials: "include" }),
      ]);
      if (evRes.ok) {
        const ev = await evRes.json();
        setEvents(ev.data ?? []);
        setTotal(ev.total ?? 0);
      }
      if (stRes.ok) {
        const st = await stRes.json();
        setStats(st.stats ?? []);
        setSeverityCounts(st.severityCounts ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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

  const resolveEvent = async (id: string) => {
    await fetch(`/api/admin/security/events/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    await load();
  };

  const exportCsv = () => {
    const header = "detected_at,ip_address,attack_type,severity,status,route_path\n";
    const rows = events
      .map(
        (e) =>
          `"${e.detected_at}","${e.ip_address}","${e.attack_type}","${e.severity_level}","${e.status}","${e.route_path ?? ""}"`
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lawygo-security-events-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxStat = Math.max(1, ...stats.map((s) => s.count));

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield size={26} className="text-primary-600" />
              보안 위협 실시간 모니터링
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Enterprise_Log_Monitoring 기반 SOC 대시보드 — 탐지 로그·통계·접속 점검
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={16} className="mr-1" />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
            <ScanLine size={16} className="mr-1" />
            {scanning ? "점검 중…" : "접속 환경 점검"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={events.length === 0}>
            <Download size={16} className="mr-1" />
            CSV 내보내기
          </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
          <div key={sev} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-card">
            <p className="text-xs font-medium text-slate-500 uppercase">{sev}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{severityCounts[sev] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">공격 유형별 현황 (Real-time DB Data)</h2>
          {stats.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">탐지 데이터가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {stats.map((s, i) => (
                <li key={s.attackType}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 truncate pr-2">{s.attackType}</span>
                    <span className="font-medium text-slate-900 shrink-0">{s.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(s.count / maxStat) * 100}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h2 className="font-semibold text-slate-900 mb-2">관제 요약</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">총 탐지 건수</dt>
              <dd className="text-xl font-bold text-slate-900">{total}</dd>
            </div>
            <div>
              <dt className="text-text-muted">공격 유형 수</dt>
              <dd className="text-xl font-bold text-slate-900">{stats.length}</dd>
            </div>
          </dl>
          <p className="text-xs text-text-muted mt-4 leading-relaxed">
            Rate limit 초과, 로그인 실패, 관리자 무인증 접근 등이 자동 기록됩니다.
            「접속 환경 점검」은 Enterprise_Log_Monitoring의 PC 점검(/scan/my-pc)과 동일하게
            현재 브라우저 User-Agent를 분석합니다.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">최근 탐지 로그 (Total: {total} 건)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">IP Address</th>
                <th className="px-4 py-3 font-medium">Attack Type</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                    불러오는 중…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                    현재 탐지된 보안 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                events.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatTime(log.detected_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.ip_address}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={log.attack_type}>
                      {log.attack_type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLE[log.severity_level] ?? ""}`}
                      >
                        {log.severity_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.status}</td>
                    <td className="px-4 py-3">
                      {log.status !== "RESOLVED" && (
                        <button
                          type="button"
                          className="text-xs text-primary-600 hover:underline"
                          onClick={() => resolveEvent(log.id)}
                        >
                          처리완료
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
