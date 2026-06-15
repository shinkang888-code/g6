"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type TaxDoc = {
  id: string;
  doc_type: string;
  status: string;
  amount: number;
  client_name?: string;
  created_at: string;
};

export function FinanceTaxDocuments() {
  const [docs, setDocs] = useState<TaxDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState<"세금계산서" | "현금영수증">("세금계산서");
  const [amount, setAmount] = useState("");
  const [clientName, setClientName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/tax-documents", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setDocs(Array.isArray(data.documents) ? data.documents : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  const handleCreate = async () => {
    const num = Number(amount.replace(/,/g, ""));
    if (!num || num <= 0) {
      toast.error("금액을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/tax-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ docType, amount: num, clientName: clientName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "등록에 실패했습니다.");
        return;
      }
      toast.success(data.message ?? "발행 초안이 등록되었습니다.");
      setOpen(false);
      setAmount("");
      setClientName("");
      await fetchDocs();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-slate-800">세금·현금영수증</h3>
        </div>
        <Button size="xs" variant="outline" leftIcon={<Plus size={12} />} onClick={() => setOpen((v) => !v)}>
          발행 초안
        </Button>
      </div>

      {open && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
          <div className="flex gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as "세금계산서" | "현금영수증")}
              className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="세금계산서">세금계산서</option>
              <option value="현금영수증">현금영수증</option>
            </select>
            <input
              type="number"
              placeholder="금액"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <input
            placeholder="거래처명"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />
          <Button size="sm" onClick={handleCreate} loading={saving} disabled={saving}>
            초안 등록
          </Button>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center text-slate-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">등록된 증빙 초안이 없습니다.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {docs.slice(0, 5).map((d) => (
            <div key={d.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium text-slate-800">{d.doc_type}</div>
                <div className="text-xs text-text-muted">
                  {d.client_name || "—"} · {formatDate(d.created_at.slice(0, 10))} · {d.status}
                </div>
              </div>
              <span className="font-bold tabular-nums">{formatAmount(Number(d.amount))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
