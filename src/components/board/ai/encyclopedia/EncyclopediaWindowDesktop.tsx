// filepath: src/components/board/ai/encyclopedia/EncyclopediaWindowDesktop.tsx
"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { EncyclopediaLayoutConfig, EncyclopediaPanelId } from "@/lib/legalEncyclopedia/layoutConfig";
import type { EncyclopediaWindowConfig, PanelWindowState } from "@/lib/legalEncyclopedia/windowManager";
import {
  closeWindow,
  focusWindow,
  getFluidDisplayWindows,
  minimizeWindow,
  openWindowFromDesktop,
  toggleMaximizeWindow,
  updateWindow,
} from "@/lib/legalEncyclopedia/windowManager";
import { PANEL_META } from "@/components/board/ai/encyclopedia/panelMeta";
import { EncyclopediaWindowFrame } from "@/components/board/ai/encyclopedia/EncyclopediaWindowFrame";

type PanelContent = Record<EncyclopediaPanelId, React.ReactNode | undefined>;

type Props = {
  layout: EncyclopediaLayoutConfig;
  windowConfig: EncyclopediaWindowConfig;
  uiEditMode: boolean;
  content: PanelContent;
  mainFooter?: React.ReactNode;
  onWindowConfigChange: (config: EncyclopediaWindowConfig) => void;
  onOpenPopup: (id: EncyclopediaPanelId) => void;
};

function scrollModeFor(layout: EncyclopediaLayoutConfig, id: EncyclopediaPanelId): "scroll" | "none" {
  return layout.panels.find((p) => p.id === id)?.scrollMode ?? "scroll";
}

function isPanelVisible(layout: EncyclopediaLayoutConfig, id: EncyclopediaPanelId): boolean {
  return layout.panels.find((p) => p.id === id)?.visible !== false;
}

export function EncyclopediaWindowDesktop({
  layout,
  windowConfig,
  uiEditMode,
  content,
  mainFooter,
  onWindowConfigChange,
  onOpenPopup,
}: Props) {
  const setWindows = (windows: PanelWindowState[]) => {
    onWindowConfigChange({ ...windowConfig, windows });
  };

  const displayWindows = useMemo(
    () =>
      getFluidDisplayWindows(
        windowConfig.windows,
        (id) => isPanelVisible(layout, id),
        uiEditMode
      ),
    [windowConfig.windows, layout.panels, uiEditMode]
  );

  const visibleWindows = displayWindows.filter(
    (w) => isPanelVisible(layout, w.id) && !w.closed && !w.minimized
  );

  const minimizedWindows = windowConfig.windows.filter(
    (w) => isPanelVisible(layout, w.id) && !w.closed && w.minimized
  );

  return (
    <div className="hidden lg:flex flex-1 w-full min-w-0 min-h-0 h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-[#e8eef7] shadow-inner">
      {/* 바탕화면 아이콘 영역 */}
      <aside className="w-[76px] shrink-0 border-r border-slate-300/60 bg-gradient-to-b from-slate-100/90 to-slate-200/50 p-2 flex flex-col gap-1 overflow-y-auto">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center mb-1">바탕화면</p>
        {layout.panels
          .filter((p) => p.visible)
          .sort((a, b) => a.mobileOrder - b.mobileOrder)
          .map((panel) => {
            const meta = PANEL_META[panel.id];
            const win = windowConfig.windows.find((w) => w.id === panel.id);
            const isOpen = win && !win.closed && !win.minimized;
            const isMin = win?.minimized;
            return (
              <button
                key={panel.id}
                type="button"
                title={`${meta.shortLabel} 열기`}
                onClick={() => setWindows(openWindowFromDesktop(windowConfig.windows, panel.id))}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all group",
                  "hover:bg-white/70 hover:shadow-md active:scale-95",
                  isOpen && "bg-white/80 shadow-sm ring-1 ring-indigo-200",
                  isMin && "opacity-70 ring-1 ring-amber-200"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm border border-slate-200/80",
                    "group-hover:border-indigo-200"
                  )}
                >
                  {meta.desktopIcon}
                </div>
                <span className="text-[9px] font-semibold text-slate-700 text-center leading-tight line-clamp-2 w-full">
                  {meta.shortLabel}
                </span>
              </button>
            );
          })}
      </aside>

      {/* 윈도우 작업 영역 */}
      <div className="relative flex-1 min-w-0 min-h-0 m-1 rounded-xl overflow-hidden bg-[linear-gradient(135deg,#dbeafe_0%,#e0e7ff_40%,#f1f5f9_100%)]">
        {uiEditMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] text-[10px] font-semibold text-indigo-800 bg-white/90 border border-indigo-200 px-3 py-1 rounded-full shadow-sm">
            UI 편집 — 프레임을 드래그·모서리로 크기 조절 · 타이틀 더블클릭 최대화
          </div>
        )}

        {visibleWindows.map((win) => (
          <EncyclopediaWindowFrame
            key={win.id}
            win={win}
            scrollMode={scrollModeFor(layout, win.id)}
            uiEditMode={uiEditMode}
            footer={win.id === "main" ? mainFooter : undefined}
            onFocus={() => setWindows(focusWindow(windowConfig.windows, win.id))}
            onMove={(patch) => setWindows(updateWindow(windowConfig.windows, win.id, patch))}
            onResize={(patch) => setWindows(updateWindow(windowConfig.windows, win.id, patch))}
            onMinimize={() => setWindows(minimizeWindow(windowConfig.windows, win.id))}
            onMaximize={() => setWindows(toggleMaximizeWindow(windowConfig.windows, win.id))}
            onClose={() => setWindows(closeWindow(windowConfig.windows, win.id))}
            onOpenPopup={() => onOpenPopup(win.id)}
          >
            {content[win.id]}
          </EncyclopediaWindowFrame>
        ))}

        {visibleWindows.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-sm">
            <p>열린 프레임이 없습니다.</p>
            <p className="text-xs mt-1">왼쪽 바탕화면 아이콘을 클릭해 창을 여세요.</p>
          </div>
        )}

        {/* 작업 표시줄 (최소화) */}
        {minimizedWindows.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-[200] flex gap-1 px-2 py-1.5 bg-slate-800/90 backdrop-blur-md border-t border-slate-600/50">
            {minimizedWindows.map((win) => (
              <button
                key={win.id}
                type="button"
                onClick={() => setWindows(openWindowFromDesktop(windowConfig.windows, win.id))}
                className="px-3 py-1 rounded-md text-[11px] font-semibold text-white/90 bg-white/10 hover:bg-white/20 border border-white/10 truncate max-w-[140px]"
              >
                {PANEL_META[win.id].shortLabel}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
