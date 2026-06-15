"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SecurityEventRow, AttackTypeStat } from "@/lib/security/securityEventTypes";

export type LogFilterPreset = {
  hours?: number;
  unresolved?: boolean;
  source?: string;
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-100 text-slate-700",
};

const STATUS_OPTIONS = ["", "MONITORED", "WARNING", "BLOCKED", "RESOLVED"] as const;
const SEVERITY_OPTIONS = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const SOURCE_OPTIONS = ["", "auth", "api", "admin", "ai", "upload", "scan", "rule"] as const;

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function hoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

type Filters = {
  search: string;
  severity: string;
  status: string;
  source: string;
  ip: string;
  attackType: string;
  from: string;
  to: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  severity: "",
  status: "",
  source: "",
  ip: "",
  attackType: "",
  from: "",
  to: "",
};

export default function SecurityLogExplorer({
  initialPreset,
}: {
  initialPreset?: LogFilterPreset | null;
}) {
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<AttackTypeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selected, setSelected] = useState<SecurityEventRow | null>(null);

  useEffect(() => {
    if (!initialPreset) return;
    setFilters({
      ...DEFAULT_FILTERS,
      from: initialPreset.hours ? hoursAgoIso(initialPreset.hours) : "",
      status: initialPreset.unresolved ? "__unresolved__" : "",
      source: initialPreset.source ?? "",
    });
    setPage(1);
  }, [initialPreset]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    if (filters.search) p.set("search", filters.search);
    if (filters.severity) p.set("severity", filters.severity);
    if (filters.status === "__unresolved__") p.set("unresolved", "1");
    else if (filters.status) p.set("status", filters.status);
    if (filters.source) p.set("source", filters.source);
    if (filters.ip) p.set("ip", filters.ip);
    if (filters.attackType) p.set("attackType", filters.attackType);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    return p.toString();
  }, [page, pageSize, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, stRes] = await Promise.all([
        fetch(`/api/admin/security/events?${queryString}`, { credentials: "include" }),
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
      }
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const resolveEvent = async (id: string) => {
    await fetch(`/api/admin/security/events/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    await load();
    setSelected((s) => (s?.id === id ? { ...s, status: "RESOLVED" } : s));
  };

  const exportCsv = async () => {
    const p = new URLSearchParams(queryString);
    p.set("page", "1");
    p.set("page_size", "100");
    const res = await fetch(`/api/admin/security/events?${p}`, { credentials: "include" });
    const json = await res.json().catch(() => ({ data: events }));
    const rows = (json.data ?? events) as SecurityEventRow[];
    const header =
      "detected_at,ip_address,attack_type,severity,status,source,route_path,actor_login_id,user_agent\n";
    const body = rows
      .map(
        (e) =>
          `"${e.detected_at}","${e.ip_address}","${e.attack_type}","${e.severity_level}","${e.status}","${e.source}","${e.route_path ?? ""}","${e.actor_login_id ?? ""}","${(e.user_agent ?? "").replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lawygo-security-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickFilter = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">서버 보안·접속 로그</h2>
          <p className="text-sm text-text-muted">전체 {total.toLocaleString()}건 · 필터·검색·페이지 탐색</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            30초 자동 새로고침
          </label>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <Filter size={14} className="mr-1" />
            필터
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={cn("mr-1", loading && "animate-spin")} />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={events.length === 0}>
            <Download size={14} className="mr-1" />
            CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "전체", fn: () => setFilters(DEFAULT_FILTERS) },
          { label: "24시간", fn: () => quickFilter({ from: hoursAgoIso(24), to: "" }) },
          { label: "7일", fn: () => quickFilter({ from: hoursAgoIso(168), to: "" }) },
          { label: "미처리", fn: () => quickFilter({ status: "__unresolved__", from: "", to: "" }) },
          { label: "인증", fn: () => quickFilter({ source: "auth", from: "", to: "" }) },
          { label: "Rate limit", fn: () => quickFilter({ attackType: "Rate Limit", from: "", to: "" }) },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => {
              chip.fn();
              setPage(1);
            }}
            className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="text-xs font-medium text-slate-500">통합 검색</span>
            <div className="relative mt-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(e) => quickFilter({ search: e.target.value })}
                placeholder="IP, 경로, 공격유형, 계정…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">심각도</span>
            <select
              value={filters.severity}
              onChange={(e) => quickFilter({ severity: e.target.value })}
              className="mt-1 w-full py-2 px-2 rounded-xl border border-slate-200 text-sm"
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o || "all"} value={o}>
                  {o || "전체"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">상태</span>
            <select
              value={filters.status}
              onChange={(e) => quickFilter({ status: e.target.value })}
              className="mt-1 w-full py-2 px-2 rounded-xl border border-slate-200 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o || "all"} value={o}>
                  {o || "전체"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">소스</span>
            <select
              value={filters.source}
              onChange={(e) => quickFilter({ source: e.target.value })}
              className="mt-1 w-full py-2 px-2 rounded-xl border border-slate-200 text-sm"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o || "all"} value={o}>
                  {o || "전체"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">IP</span>
            <input
              value={filters.ip}
              onChange={(e) => quickFilter({ ip: e.target.value })}
              className="mt-1 w-full py-2 px-2 rounded-xl border border-slate-200 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">시작일</span>
            <input
              type="datetime-local"
              value={filters.from ? filters.from.slice(0, 16) : ""}
              onChange={(e) =>
                quickFilter({ from: e.target.value ? new Date(e.target.value).toISOString() : "" })
              }
              className="mt-1 w-full py-2 px-2 rounded-xl border border-slate-200 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">종료일</span>
            <input
              type="datetime-local"
              value={filters.to ? filters.to.slice(0, 16) : ""}
              onChange={(e) =>
                quickFilter({ to: e.target.value ? new Date(e.target.value).toISOString() : "" })
              }
              className="mt-1 w-full py-2 px-2 rounded-xl border border-slate-200 text-sm"
            />
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setPage(1);
              }}
            >
              필터 초기화
            </Button>
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.slice(0, 6).map((s) => (
            <button
              key={s.attackType}
              type="button"
              onClick={() => quickFilter({ attackType: s.attackType })}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-primary-50 text-slate-700"
            >
              {s.attackType} <strong className="ml-1">{s.count}</strong>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-medium">시간</th>
                  <th className="px-3 py-2.5 font-medium">IP</th>
                  <th className="px-3 py-2.5 font-medium">유형</th>
                  <th className="px-3 py-2.5 font-medium">등급</th>
                  <th className="px-3 py-2.5 font-medium">소스</th>
                  <th className="px-3 py-2.5 font-medium"></th>
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
                      조건에 맞는 로그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  events.map((log) => (
                    <tr
                      key={log.id}
                      className={cn(
                        "border-t border-slate-100 hover:bg-slate-50/50 cursor-pointer",
                        selected?.id === log.id && "bg-primary-50/50"
                      )}
                      onClick={() => setSelected(log)}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600">
                        {formatTime(log.detected_at)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{log.ip_address}</td>
                      <td className="px-3 py-2.5 max-w-[140px] truncate text-xs" title={log.attack_type}>
                        {log.attack_type}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_STYLE[log.severity_level] ?? ""}`}
                        >
                          {log.severity_level}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{log.source}</td>
                      <td className="px-3 py-2.5">
                        <Eye size={14} className="text-slate-400" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>
                {page} / {totalPages} 페이지
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="py-1 px-2 rounded border border-slate-200"
              >
                {[20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}건
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 min-h-[200px]">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">이벤트 상세</h3>
                <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <dl className="space-y-2 text-xs">
                {[
                  ["시간", formatTime(selected.detected_at)],
                  ["IP", selected.ip_address],
                  ["공격 유형", selected.attack_type],
                  ["심각도", selected.severity_level],
                  ["상태", selected.status],
                  ["소스", selected.source],
                  ["경로", selected.route_path ?? "—"],
                  ["계정", selected.actor_login_id ?? "—"],
                  ["User-Agent", selected.user_agent ?? "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-slate-900 break-all mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
              {selected.status !== "RESOLVED" && (
                <Button type="button" size="sm" className="w-full" onClick={() => void resolveEvent(selected.id)}>
                  처리완료
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-12">목록에서 로그를 선택하면 상세 정보가 표시됩니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
