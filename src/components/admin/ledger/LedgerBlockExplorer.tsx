"use client";

import { useCallback, useEffect, useState } from "react";
import { LEDGER_STREAM_LABELS, type LedgerStream } from "@/lib/ledger/types";

type BlockRow = {
  id: string;
  tenant_id: string;
  stream: string;
  block_height: number;
  merkle_root: string;
  block_hash: string;
  tx_count: number;
  created_at: string;
  anchor: {
    anchor_hash: string;
    external_network: string;
    external_tx_id: string | null;
    anchored_at: string;
  } | null;
};

export default function LedgerBlockExplorer({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ledger/blocks?page=${page}&pageSize=15`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setRows(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        거래 해시들이 Merkle 트리로 묶인 블록입니다. 각 블록은 외부 앵커(타임스탬프)로 불변성이 증명됩니다.
      </p>

      {loading ? (
        <p className="text-sm text-text-muted py-6">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted py-6">아직 생성된 블록이 없습니다. 워커 실행 후 확인하세요.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-slate-900">
                  블록 #{b.block_height}
                </span>
                <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">
                  {LEDGER_STREAM_LABELS[b.stream as LedgerStream] ?? b.stream}
                </span>
                <span className="text-xs text-slate-500">{b.tx_count} tx</span>
                <span className="text-xs text-slate-400 ml-auto">
                  {new Date(b.created_at).toLocaleString("ko-KR")}
                </span>
              </div>
              <dl className="grid gap-1 text-xs font-mono">
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-24 shrink-0">Merkle Root</dt>
                  <dd className="truncate text-slate-700" title={b.merkle_root}>{b.merkle_root}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-24 shrink-0">Block Hash</dt>
                  <dd className="truncate text-slate-700" title={b.block_hash}>{b.block_hash}</dd>
                </div>
                {b.anchor ? (
                  <>
                    <div className="flex gap-2 mt-1 pt-1 border-t">
                      <dt className="text-emerald-600 w-24 shrink-0">앵커 ✓</dt>
                      <dd className="text-emerald-700">{b.anchor.external_network}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400 w-24 shrink-0">Anchor Hash</dt>
                      <dd className="truncate text-slate-700">{b.anchor.anchor_hash}</dd>
                    </div>
                  </>
                ) : (
                  <div className="text-amber-600 mt-1">외부 앵커 대기 중</div>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}

      {total > 15 && (
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            disabled={page <= 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </button>
          <span className="px-3 py-1 text-sm">{page}</span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / 15)}
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
