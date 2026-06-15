"use client";

import { useState, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CaseHit = {
  id: string;
  caseNumber: string;
  caseName: string;
  clientName: string;
};

type Props = {
  caseId: string;
  caseNumber: string;
  caseName?: string;
  onSelect: (hit: CaseHit | null) => void;
};

export function CaseSearchPicker({ caseId, caseNumber, caseName, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CaseHit[]>([]);
  const [open, setOpen] = useState(false);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, page: "1", page_size: "15" });
      const res = await fetch(`/api/admin/cases?${params}`, { credentials: "include" });
      const json = await res.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      setResults(
        rows.map((r: Record<string, unknown>) => ({
          id: String(r.id ?? ""),
          caseNumber: String(r.caseNumber ?? r.case_number ?? ""),
          caseName: String(r.caseName ?? r.case_name ?? ""),
          clientName: String(r.clientName ?? r.client_name ?? ""),
        }))
      );
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">관련사건</label>
      {caseId ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm">
          <span className="font-medium text-primary-800 flex-1 truncate">
            {caseNumber}
            {caseName ? ` · ${caseName}` : ""}
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="p-1 text-slate-500 hover:text-danger-600"
            aria-label="사건 연결 해제"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void search())}
            placeholder="사건번호·의뢰인·사건명"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 outline-none"
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={loading || !query.trim()}
            className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            검색
          </button>
        </div>
      )}
      {open && !caseId && (
        <ul className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-xs text-text-muted text-center">검색 결과가 없습니다.</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(r);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50",
                    "flex flex-col gap-0.5"
                  )}
                >
                  <span className="font-medium text-slate-800">{r.caseNumber}</span>
                  <span className="text-xs text-text-muted truncate">
                    {r.clientName} · {r.caseName}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
