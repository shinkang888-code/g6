"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Shield,
  Link2,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEDGER_STREAM_LABELS, type LedgerStream } from "@/lib/ledger/types";

type OverviewData = {
  enabled: boolean;
  health: "healthy" | "degraded" | "critical" | "disabled";
  healthMessage: string;
  identityCount: number;
  txPending: number;
  txChained: number;
  txBlockAssigned: number;
  txTampered: number;
  blockCount: number;
  anchorCount: number;
  alertOpen: number;
  lastBlockAt: string | null;
  lastAnchorAt: string | null;
  streams: { stream: string; pending: number; chained: number; blocks: number }[];
  config?: { anchorProvider: string; blockThreshold: string };
};

const HEALTH_STYLE = {
  healthy: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  degraded: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  critical: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  disabled: { icon: Shield, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
};

export default function LedgerOverviewPanel({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [lastWorker, setLastWorker] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ledger/overview", { credentials: "include" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const runWorker = async (action: "worker" | "scan") => {
    setWorking(true);
    try {
      const res = await fetch("/api/admin/ledger/worker", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      setLastWorker(JSON.stringify(json, null, 2));
      onRefresh();
      await load();
    } finally {
      setWorking(false);
    }
  };

  if (loading && !data) {
    return <div className="text-sm text-text-muted py-8">원장 상태 불러오는 중…</div>;
  }

  const health = data?.health ?? "disabled";
  const hs = HEALTH_STYLE[health];
  const HealthIcon = hs.icon;

  return (
    <div className="space-y-6">
      <div className={cn("rounded-xl border p-5 flex items-start gap-4", hs.bg)}>
        <HealthIcon className={cn("shrink-0 mt-0.5", hs.color)} size={28} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">
            {health === "healthy" && "원장 정상"}
            {health === "degraded" && "주의 — 처리 지연"}
            {health === "critical" && "위험 — 무결성 이상"}
            {health === "disabled" && "분산 원장 비활성"}
          </p>
          <p className="text-sm text-slate-600 mt-1">{data?.healthMessage}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" disabled={working} onClick={() => runWorker("worker")}>
            <RefreshCw size={14} className={cn("mr-1", working && "animate-spin")} />
            체인·블록 처리
          </Button>
          <Button variant="outline" size="sm" disabled={working} onClick={() => runWorker("scan")}>
            <Shield size={14} className="mr-1" />
            무결성 검사
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="신원 해시 H_v" value={data?.identityCount ?? 0} icon={Shield} />
        <StatCard label="대기 거래" value={data?.txPending ?? 0} icon={Clock} accent={data?.txPending ? "amber" : undefined} />
        <StatCard label="Merkle 블록" value={data?.blockCount ?? 0} icon={Link2} />
        <StatCard label="외부 앵커" value={data?.anchorCount ?? 0} icon={Activity} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold text-slate-800 mb-3">거래 파이프라인</h3>
          <dl className="space-y-2 text-sm">
            <Row label="체인 완료 (chained)" value={data?.txChained ?? 0} />
            <Row label="블록 배정 (block_assigned)" value={data?.txBlockAssigned ?? 0} />
            <Row label="변조 탐지 (tampered)" value={data?.txTampered ?? 0} danger={!!data?.txTampered} />
            <Row label="미해결 알림" value={data?.alertOpen ?? 0} danger={!!data?.alertOpen} />
          </dl>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold text-slate-800 mb-3">최근 활동</h3>
          <dl className="space-y-2 text-sm">
            <Row label="마지막 블록" value={formatTime(data?.lastBlockAt)} />
            <Row label="마지막 앵커" value={formatTime(data?.lastAnchorAt)} />
            <Row label="앵커 제공자" value={data?.config?.anchorProvider ?? "-"} />
            <Row label="블록 임계값" value={data?.config?.blockThreshold ?? "50"} />
          </dl>
        </div>
      </div>

      {data?.streams && data.streams.length > 0 && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h3 className="font-semibold text-slate-800">스트림별 현황</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="px-4 py-2 font-medium">스트림</th>
                <th className="px-4 py-2 font-medium">대기</th>
                <th className="px-4 py-2 font-medium">체인됨</th>
                <th className="px-4 py-2 font-medium">블록</th>
              </tr>
            </thead>
            <tbody>
              {data.streams.map((s) => (
                <tr key={s.stream} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">
                    {LEDGER_STREAM_LABELS[s.stream as LedgerStream] ?? s.stream}
                  </td>
                  <td className="px-4 py-2">{s.pending}</td>
                  <td className="px-4 py-2">{s.chained}</td>
                  <td className="px-4 py-2">{s.blocks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastWorker && (
        <details className="rounded-xl border bg-slate-50 p-4 text-xs">
          <summary className="cursor-pointer font-medium text-slate-700">마지막 워커 실행 결과</summary>
          <pre className="mt-2 overflow-x-auto text-slate-600 whitespace-pre-wrap">{lastWorker}</pre>
        </details>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
  accent?: "amber";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
        <Icon size={14} />
        {label}
      </div>
      <p className={cn("text-2xl font-bold", accent === "amber" && value > 0 && "text-amber-600")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("font-medium tabular-nums", danger && "text-red-600")}>{value}</dd>
    </div>
  );
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}
