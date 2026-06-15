"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AlertRow = {
  id: string;
  tenant_id: string;
  alert_type: string;
  tamper_point_tx_id: string | null;
  replay_status: string;
  details: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
};

const ALERT_LABEL: Record<string, string> = {
  tx_hash_mismatch: "거래 해시 불일치 (H_i)",
  merkle_root_mismatch: "Merkle Root 불일치",
  anchor_mismatch: "외부 앵커 불일치",
  chain_break: "체인 단절",
  missing_h_v: "신원 해시 H_v 누락",
};

export default function LedgerAlertsPanel({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openOnly, setOpenOnly] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ledger/alerts?open=${openOnly ? "1" : "0"}`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setRows(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [openOnly]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const runReplay = async (alertId: string) => {
    await fetch("/api/admin/ledger/worker", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "replay", alertId }),
    });
    onRefresh();
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          미해결만
        </label>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted py-6">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-6 text-center">
          <p className="text-emerald-800 font-medium">무결성 알림 없음</p>
          <p className="text-sm text-emerald-600 mt-1">3단계 검증(거래→블록→앵커) 모두 정상입니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <div
              key={a.id}
              className={cn(
                "rounded-xl border p-4",
                a.resolved_at ? "bg-slate-50 border-slate-200" : "bg-red-50 border-red-200"
              )}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  className={a.resolved_at ? "text-slate-400" : "text-red-600 shrink-0 mt-0.5"}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">
                    {ALERT_LABEL[a.alert_type] ?? a.alert_type}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(a.created_at).toLocaleString("ko-KR")} · 테넌트 {a.tenant_id}
                  </p>
                  {a.tamper_point_tx_id && (
                    <p className="text-xs font-mono mt-1 text-red-700">
                      변조 지점 TX: {a.tamper_point_tx_id}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 mt-2">
                    Replay: {a.replay_status}
                    {a.resolved_at && ` · 해결 ${new Date(a.resolved_at).toLocaleString("ko-KR")}`}
                  </p>
                </div>
                {!a.resolved_at && (
                  <Button variant="outline" size="sm" onClick={() => runReplay(a.id)}>
                    리플레이 검증
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
