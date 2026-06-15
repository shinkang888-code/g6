// filepath: src/components/board/ai/encyclopedia/EncyclopediaRankStrip.tsx
"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RankedLegalDocument } from "@/lib/legalEncyclopedia/types";

type Props = {
  documents: RankedLegalDocument[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function EncyclopediaRankStrip({ documents, selectedIndex, onSelect }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);

  if (documents.length <= 1) return null;

  const scrollStrip = (dir: -1 | 1) => {
    stripRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  return (
    <div className="shrink-0 border-t border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100/80">
        <ListOrdered size={13} className="text-indigo-600 shrink-0" />
        <span className="text-[11px] font-bold text-slate-700">235 순위화 프레임 — 하단 페이지 프레임</span>
        <span className="text-[10px] text-slate-500 ml-1 hidden sm:inline">
          가로 스크롤 · 관련도 높은 순
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => scrollStrip(-1)}
            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="순위 목록 왼쪽"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => scrollStrip(1)}
            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="순위 목록 오른쪽"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div
        ref={stripRef}
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 py-3 patent-frame-scroll"
      >
        {documents.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "shrink-0 min-w-[132px] max-w-[200px] text-left rounded-xl border px-3 py-2.5 transition-all",
              i === selectedIndex
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold">P{i + 1}</span>
              <span
                className={cn(
                  "text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded",
                  i === selectedIndex ? "bg-white/20" : "bg-indigo-50 text-indigo-700"
                )}
              >
                {d.rankingScore}
              </span>
            </div>
            <p
              className={cn(
                "text-[10px] mt-1 line-clamp-2 leading-snug",
                i === selectedIndex ? "text-indigo-100" : "text-slate-500"
              )}
            >
              {d.title}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
