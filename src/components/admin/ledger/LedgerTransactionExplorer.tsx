"use client";

import { useCallback, useEffect, useState } from "react";
import { LEDGER_STREAM_LABELS, type LedgerStream } from "@/lib/ledger/types";
import { cn } from "@/lib/utils";

type TxRow = {
  id: string;
  tenant_id: string;
  stream: string;
  source_table: string;
  status: string;
  tx_hash: string | null;
  prev_hash: string | null;
  seq: number | null;
  created_at: string;
  trans_data: Record<string, unknown>;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  chained: "bg-blue-100 text-blue-800",
  block_assigned: "bg-emerald-100 text-emerald-800",
  tampered: "bg-red-100 text-red-800",
};

export default function LedgerTransactionExplorer({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stream, setStream] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (stream) params.set("stream", stream);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/ledger/transactions?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setRows(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, stream, status]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={stream}
          onChange={(e) => { setStream(e.target.value); setPage(1); }}
        >
          <option value="">전체 스트림</option>
          {Object.entries(LEDGER_STREAM_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">전체 상태</option>
          <option value="pending">pending</option>
          <option value="chained">chained</option>
          <option value="block_assigned">block_assigned</option>
          <option value="tampered">tampered</option>
        </select>
        <span className="text-sm text-text-muted ml-auto">총 {total.toLocaleString()}건</span>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted py-6">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted py-6">거래 로그가 없습니다. 로그인·감사·결재 이벤트 발생 후 표시됩니다.</p>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-slate-500 border-b bg-slate-50">
                <th className="px-3 py-2">시각</th>
                <th className="px-3 py-2">스트림</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">seq</th>
                <th className="px-3 py-2">H_i (tx_hash)</th>
                <th className="px-3 py-2">내용</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">
                    {LEDGER_STREAM_LABELS[r.stream as LedgerStream] ?? r.stream}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", STATUS_COLOR[r.status] ?? "bg-slate-100")}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.seq ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs max-w-[140px] truncate" title={r.tx_hash ?? ""}>
                    {r.tx_hash ? `${r.tx_hash.slice(0, 12)}…` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px] truncate">
                    {summarizeTransData(r.trans_data)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            disabled={page <= 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </button>
          <span className="px-3 py-1 text-sm">{page} / {Math.ceil(total / 20)}</span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function summarizeTransData(data: Record<string, unknown>): string {
  const action = data.action ?? data.eventType;
  const title = data.docTitle ?? data.summary ?? data.caseNumber;
  const parts = [action, title].filter(Boolean);
  return parts.length ? String(parts.join(" · ")) : JSON.stringify(data).slice(0, 60);
}
