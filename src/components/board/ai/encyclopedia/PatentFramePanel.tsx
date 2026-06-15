// filepath: src/components/board/ai/encyclopedia/PatentFramePanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type PatentFramePanelProps = {
  moduleId?: string;
  title: string;
  icon?: ReactNode;
  accent?: "indigo" | "violet" | "blue" | "slate" | "amber";
  minWidth?: number;
  className?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  showScrollControls?: boolean;
  /** scroll: 내부 스크롤 | none: 세로·가로 스크롤 없음(overflow hidden) */
  scrollMode?: "scroll" | "none";
  /** 스크롤 영역 최소 높이 — 250% 등 장문 탐색용 */
  scrollContentMinHeight?: string;
  /** contentOnly: 헤더 없이 본문만 (윈도우 프레임 내부용) */
  variant?: "default" | "contentOnly";
};

const ACCENT: Record<NonNullable<PatentFramePanelProps["accent"]>, string> = {
  indigo: "from-indigo-50 to-white border-indigo-100/80 text-indigo-900",
  violet: "from-violet-50 to-white border-violet-100/80 text-violet-900",
  blue: "from-blue-50 to-white border-blue-100/80 text-blue-900",
  slate: "from-slate-50 to-white border-slate-200 text-slate-800",
  amber: "from-amber-50 to-white border-amber-100/80 text-amber-900",
};

export function PatentFramePanel({
  moduleId,
  title,
  icon,
  accent = "slate",
  minWidth = 240,
  className,
  headerExtra,
  footer,
  children,
  showScrollControls = true,
  scrollMode = "scroll",
  scrollContentMinHeight,
  variant = "default",
}: PatentFramePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const refreshScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanUp(el.scrollTop > 4);
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ top: delta, behavior: "smooth" });
    window.setTimeout(refreshScrollState, 320);
  };

  useEffect(() => {
    refreshScrollState();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => refreshScrollState());
    ro.observe(el);
    return () => ro.disconnect();
  }, [refreshScrollState, children]);

  const noScroll = scrollMode === "none";

  return (
    <section
      className={cn(
        "flex flex-col h-full min-h-0 shrink-0 rounded-2xl border bg-white/95 shadow-sm overflow-hidden",
        className
      )}
      style={{ minWidth: noScroll ? undefined : minWidth }}
    >
      {variant === "default" && (
      <header
        className={cn(
          "shrink-0 px-4 py-2.5 border-b bg-gradient-to-r flex items-center gap-2",
          ACCENT[accent]
        )}
      >
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {moduleId && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/70 border border-current/10 opacity-70">
                {moduleId}
              </span>
            )}
            <h3 className="text-xs font-bold tracking-tight truncate">{title}</h3>
          </div>
        </div>
        {headerExtra}
      </header>
      )}

      {variant === "contentOnly" && headerExtra ? (
        <div className="shrink-0 px-3 py-1.5 border-b border-slate-100 flex justify-end bg-slate-50/80">
          {headerExtra}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={noScroll ? undefined : refreshScrollState}
        className={cn(
          "flex-1 min-h-0 px-1",
          noScroll ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden overscroll-contain patent-frame-scroll"
        )}
        style={{ scrollbarGutter: noScroll ? undefined : "stable" }}
      >
        <div
          className={cn("p-3 md:p-4", noScroll && "h-full overflow-hidden")}
          style={!noScroll && scrollContentMinHeight ? { minHeight: scrollContentMinHeight } : undefined}
        >
          {children}
        </div>
      </div>

      {!noScroll && (footer || showScrollControls) && (
        <footer className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-3 py-2 flex items-center gap-2">
          {footer}
          {showScrollControls && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                disabled={!canUp}
                onClick={() => scrollBy(-280)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                aria-label="위로 스크롤"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={!canDown}
                onClick={() => scrollBy(280)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                aria-label="아래로 스크롤"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </footer>
      )}
    </section>
  );
}
