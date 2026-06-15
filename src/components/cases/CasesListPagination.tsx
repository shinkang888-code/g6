"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  isMobile?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
};

/** 페이지 번호 목록 (1 … 4 5 6 … 40) */
export function buildPageNumberList(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 1) return [1];
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = currentPage - 2; p <= currentPage + 2; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

export function CasesListPagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  isMobile = false,
  onPageChange,
  className,
}: Props) {
  if (totalCount <= 0) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);
  const pageNumbers = buildPageNumberList(currentPage, totalPages);

  return (
    <div
      className={cn(
        "shrink-0 bg-white border-t border-slate-200 z-20",
        isMobile && "pb-[env(safe-area-inset-bottom,0px)]",
        className
      )}
      role="navigation"
      aria-label="사건 목록 페이지"
    >
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs sm:text-sm text-slate-500 tabular-nums whitespace-nowrap">
            {from}-{to} / {totalCount}건
            {totalPages > 1 && (
              <span className="text-slate-400 ml-1">
                ({currentPage}/{totalPages}페이지)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size={isMobile ? "sm" : "xs"}
              className={isMobile ? "min-h-[44px] min-w-[44px] px-2" : undefined}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              aria-label="이전 페이지"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline ml-0.5">이전</span>
            </Button>
            <Button
              variant="outline"
              size={isMobile ? "sm" : "xs"}
              className={isMobile ? "min-h-[44px] min-w-[44px] px-2" : undefined}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              aria-label="다음 페이지"
            >
              <span className="hidden sm:inline mr-0.5">다음</span>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        {totalPages > 1 && (
          <div
            className={cn(
              "flex items-center gap-1 overflow-x-auto overscroll-x-contain touch-pan-x",
              "scrollbar-thin pb-0.5 -mx-1 px-1",
              isMobile && "snap-x snap-mandatory"
            )}
          >
            {pageNumbers.reduce<(number | "gap")[]>((acc, p, i) => {
              const prev = pageNumbers[i - 1];
              if (prev !== undefined && p - prev > 1) acc.push("gap");
              acc.push(p);
              return acc;
            }, []).map((item, idx) =>
              item === "gap" ? (
                <span key={`gap-${idx}`} className="px-1 text-slate-400 text-xs shrink-0 select-none">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={currentPage === item ? "page" : undefined}
                  className={cn(
                    "shrink-0 snap-center rounded-lg font-medium tabular-nums transition-colors",
                    isMobile ? "min-w-[44px] min-h-[44px] text-sm" : "min-w-[28px] h-7 text-xs",
                    currentPage === item
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:bg-slate-200"
                  )}
                >
                  {item}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
