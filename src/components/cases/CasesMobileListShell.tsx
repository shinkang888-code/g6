"use client";

import { cn } from "@/lib/utils";

type Props = {
  listScrollRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
};

/**
 * 모바일 사건 목록 — 툴바 아래 남은 뷰포트를 최대한 채우고 내부 세로 스크롤
 */
export function CasesMobileListShell({ listScrollRef, children, footer, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col flex-1 min-h-0 w-full min-w-0",
        "max-lg:min-h-[min(560px,calc(100dvh-13rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))]",
        className
      )}
    >
      <div
        ref={listScrollRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain",
          "max-lg:[-webkit-overflow-scrolling:touch]",
          "max-lg:touch-pan-y"
        )}
        role="region"
        aria-label="사건 목록"
      >
        {children}
      </div>
      <div className="shrink-0 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
        {footer}
      </div>
    </div>
  );
}
