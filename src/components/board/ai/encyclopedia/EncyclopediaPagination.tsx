// filepath: src/components/board/ai/encyclopedia/EncyclopediaPagination.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export { PAGE_SIZE };

type Props = {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
};

function buildPageNumbers(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(totalPages - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < totalPages - 2) pages.push("…");
  pages.push(totalPages);
  return pages;
}

export function EncyclopediaPagination({ total, page, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;

  const pages = buildPageNumbers(page, totalPages);
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <nav
      className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 flex flex-col sm:flex-row items-center justify-between gap-2"
      aria-label="문서 목록 페이지"
    >
      <p className="text-[11px] text-slate-500 order-2 sm:order-1">
        전체 <span className="font-semibold text-slate-700">{total}</span>건 중{" "}
        <span className="font-semibold text-slate-700">{start}–{end}</span>
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="이전 페이지"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "min-w-[2rem] h-8 px-2 rounded-lg text-xs font-medium border transition-colors",
                p === page
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
              )}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="다음 페이지"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

export function paginateDocuments<T>(items: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}
