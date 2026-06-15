"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** 모바일 사건 테이블 가로 스크롤 + 좌우 페이드 힌트 */
export function CasesMobileTableScroll({ children, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateShadows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateShadows();
    el.addEventListener("scroll", updateShadows, { passive: true });
    const ro = new ResizeObserver(updateShadows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateShadows);
      ro.disconnect();
    };
  }, [updateShadows]);

  return (
    <div className={cn("relative max-lg:flex max-lg:flex-col max-lg:flex-1 max-lg:min-h-0", className)}>
      <p className="lg:hidden text-[10px] text-center text-slate-400 py-0.5 px-2 shrink-0 bg-slate-50/80 border-b border-slate-100">
        ← 좌우 스크롤로 전체 열 확인 →
      </p>
      <div className="relative max-lg:flex-1 max-lg:min-h-0">
        {canScrollLeft && (
          <div
            className="lg:hidden pointer-events-none absolute left-0 top-0 bottom-0 w-5 z-[1] bg-gradient-to-r from-white via-white/80 to-transparent"
            aria-hidden
          />
        )}
        {canScrollRight && (
          <div
            className="lg:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-5 z-[1] bg-gradient-to-l from-white via-white/80 to-transparent"
            aria-hidden
          />
        )}
        <div
          ref={scrollRef}
          className="overflow-x-auto overscroll-x-contain min-w-0 w-full max-lg:touch-pan-x max-lg:[-webkit-overflow-scrolling:touch]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
