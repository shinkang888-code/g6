// filepath: src/components/board/ai/encyclopedia/EncyclopediaWindowFrame.tsx
"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { ExternalLink, Minimize2, Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EncyclopediaPanelId } from "@/lib/legalEncyclopedia/layoutConfig";
import type { PanelWindowState } from "@/lib/legalEncyclopedia/windowManager";
import { PANEL_META } from "@/components/board/ai/encyclopedia/panelMeta";
import { PatentFramePanel } from "@/components/board/ai/encyclopedia/PatentFramePanel";

type Props = {
  win: PanelWindowState;
  scrollMode: "scroll" | "none";
  uiEditMode: boolean;
  children: ReactNode;
  footer?: ReactNode;
  onFocus: () => void;
  onMove: (patch: Pick<PanelWindowState, "x" | "y">) => void;
  onResize: (patch: Pick<PanelWindowState, "width" | "height">) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  onOpenPopup: () => void;
};

export function EncyclopediaWindowFrame({
  win,
  scrollMode,
  uiEditMode,
  children,
  footer,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  onClose,
  onOpenPopup,
}: Props) {
  const meta = PANEL_META[win.id];
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getParentSize = useCallback(() => {
    const parent = containerRef.current?.offsetParent as HTMLElement | null;
    return { w: parent?.clientWidth || 1, h: parent?.clientHeight || 1 };
  }, []);

  const onTitlePointerDown = (e: React.PointerEvent) => {
    if (!uiEditMode || win.maximized) return;
    e.preventDefault();
    onFocus();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: win.x, origY: win.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onTitlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { w, h } = getParentSize();
    const dx = ((e.clientX - dragRef.current.startX) / w) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / h) * 100;
    onMove({
      x: dragRef.current.origX + dx,
      y: dragRef.current.origY + dy,
    });
  };

  const onTitlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (!uiEditMode || win.maximized) return;
    e.stopPropagation();
    e.preventDefault();
    onFocus();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: win.width, origH: win.height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const { w, h } = getParentSize();
    const dw = ((e.clientX - resizeRef.current.startX) / w) * 100;
    const dh = ((e.clientY - resizeRef.current.startY) / h) * 100;
    onResize({
      width: resizeRef.current.origW + dw,
      height: resizeRef.current.origH + dh,
    });
  };

  const onResizePointerUp = (e: React.PointerEvent) => {
    resizeRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };

  const chromeBtn =
    "w-7 h-7 flex items-center justify-center rounded-md text-white/90 hover:bg-white/20 transition-colors";

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-xl border shadow-lg bg-white/98",
        uiEditMode ? "border-indigo-300 ring-1 ring-indigo-200/80" : "border-slate-200/90",
        win.maximized && "rounded-none"
      )}
      style={{
        left: `${win.x}%`,
        top: `${win.y}%`,
        width: `${win.width}%`,
        height: `${win.height}%`,
        zIndex: win.zIndex,
      }}
      onPointerDown={onFocus}
    >
      {/* 윈도우 타이틀 바 */}
      <div
        className={cn(
          "shrink-0 flex items-center gap-1 px-2 py-1.5 bg-gradient-to-r text-white select-none",
          meta.accentBg,
          uiEditMode && !win.maximized && "cursor-grab active:cursor-grabbing"
        )}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
        onDoubleClick={onMaximize}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {meta.icon && <span className="opacity-90 [&_svg]:text-white">{meta.icon}</span>}
          <span className="text-[11px] font-bold truncate">{meta.shortLabel}</span>
          {meta.moduleId && (
            <span className="hidden sm:inline font-mono text-[9px] px-1 py-0.5 rounded bg-white/15 opacity-80">
              {meta.moduleId}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={chromeBtn} title="새 창" onClick={onOpenPopup}>
            <ExternalLink size={13} />
          </button>
          <button type="button" className={chromeBtn} title="최소화" onClick={onMinimize}>
            <Minus size={14} />
          </button>
          <button type="button" className={chromeBtn} title={win.maximized ? "복원" : "최대화"} onClick={onMaximize}>
            {win.maximized ? <Minimize2 size={13} /> : <Square size={12} />}
          </button>
          <button
            type="button"
            className={cn(chromeBtn, "hover:bg-red-500/90")}
            title="닫기"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <PatentFramePanel
          title={meta.title}
          icon={meta.icon}
          accent={meta.accent}
          scrollMode={scrollMode}
          variant="contentOnly"
          showScrollControls={scrollMode === "scroll" && win.id === "main"}
          className="h-full rounded-none border-0 shadow-none"
          footer={footer}
        >
          {children}
        </PatentFramePanel>
      </div>

      {uiEditMode && !win.maximized && (
        <div
          role="presentation"
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize touch-none"
          style={{
            background: "linear-gradient(135deg, transparent 50%, rgb(99 102 241 / 0.6) 50%)",
          }}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
      )}
    </div>
  );
}

export type { EncyclopediaPanelId };
