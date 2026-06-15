// filepath: src/components/board/ai/encyclopedia/PatentMultiFaceCanvas.tsx
"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EncyclopediaLayoutConfig,
  EncyclopediaPanelConfig,
  EncyclopediaPanelId,
} from "@/lib/legalEncyclopedia/layoutConfig";
import type { EncyclopediaWindowConfig } from "@/lib/legalEncyclopedia/windowManager";
import { resizePanelPair, visiblePanelsOrdered } from "@/lib/legalEncyclopedia/layoutConfig";
import { PANEL_META } from "@/components/board/ai/encyclopedia/panelMeta";
import { PatentFramePanel } from "./PatentFramePanel";
import { EncyclopediaWindowDesktop } from "./EncyclopediaWindowDesktop";
import { EncyclopediaPanelPopup } from "./EncyclopediaPanelPopup";

export type MobileFace = EncyclopediaPanelId;

type PanelContent = {
  categoryFrame: React.ReactNode;
  mainFrame: React.ReactNode;
  aiFrame: React.ReactNode;
  adFrame?: React.ReactNode;
  fitFrame?: React.ReactNode;
  rankStrip?: React.ReactNode;
};

type Props = PanelContent & {
  layout: EncyclopediaLayoutConfig;
  windowConfig: EncyclopediaWindowConfig;
  editMode?: boolean;
  uiEditMode?: boolean;
  onLayoutChange?: (layout: EncyclopediaLayoutConfig) => void;
  onWindowConfigChange?: (config: EncyclopediaWindowConfig) => void;
  onOpenPopup?: (id: EncyclopediaPanelId) => void;
  popupPanel?: EncyclopediaPanelId | null;
  onClosePopup?: () => void;
};

function renderPanelContent(id: EncyclopediaPanelId, props: PanelContent): React.ReactNode {
  switch (id) {
    case "category":
      return props.categoryFrame;
    case "main":
      return props.mainFrame;
    case "ai":
      return props.aiFrame;
    case "ad":
      return props.adFrame;
    case "fit":
      return props.fitFrame;
    default:
      return null;
  }
}

function PanelResizeHandle({
  onResize,
  active,
}: {
  onResize: (deltaPx: number) => void;
  active: boolean;
}) {
  const dragging = { current: false };
  const lastX = { current: 0 };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active) return;
    dragging.current = true;
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    if (Math.abs(dx) > 0) onResize(dx);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        "w-1.5 shrink-0 rounded-full transition-colors touch-none select-none",
        active
          ? "cursor-col-resize bg-indigo-200 hover:bg-indigo-400 active:bg-indigo-500"
          : "bg-transparent pointer-events-none w-0"
      )}
    />
  );
}

/** 메뉴편집용 그리드 레이아웃 (UI편집 비활성 시 md~lg 구간 폴백) */
function GridLayoutRow({
  panels,
  editMode,
  layout,
  onLayoutChange,
  content,
  rankStrip,
  onOpenPopup,
}: {
  panels: EncyclopediaPanelConfig[];
  editMode: boolean;
  layout: EncyclopediaLayoutConfig;
  onLayoutChange?: (l: EncyclopediaLayoutConfig) => void;
  content: PanelContent;
  rankStrip?: React.ReactNode;
  onOpenPopup?: (id: EncyclopediaPanelId) => void;
}) {
  const containerRef = { current: null as HTMLDivElement | null };

  const handleResize = (leftId: EncyclopediaPanelId, deltaPx: number) => {
    if (!onLayoutChange || !containerRef.current) return;
    const w = containerRef.current.offsetWidth || 1;
    const deltaPercent = (deltaPx / w) * 100;
    onLayoutChange({
      ...layout,
      panels: resizePanelPair(layout.panels, leftId, deltaPercent),
    });
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
      }}
      className={cn(
        "flex flex-1 min-h-0 w-full h-full gap-0 items-stretch",
        editMode && "ring-2 ring-indigo-200/60 ring-inset rounded-2xl p-1"
      )}
    >
      {panels.map((panel, idx) => {
        const meta = PANEL_META[panel.id];
        const isMain = panel.id === "main";
        return (
          <div key={panel.id} className="contents">
            <div
              className={cn(
                "flex flex-col min-h-0 min-w-0 h-full",
                editMode && "outline outline-1 outline-dashed outline-indigo-300/70 rounded-2xl"
              )}
              style={{ flex: `0 0 ${panel.widthPercent}%`, maxWidth: `${panel.widthPercent}%` }}
            >
              <PatentFramePanel
                moduleId={meta.moduleId}
                title={meta.title}
                icon={meta.icon}
                accent={meta.accent}
                minWidth={0}
                scrollMode={panel.scrollMode}
                showScrollControls={panel.scrollMode === "scroll" && isMain}
                className="h-full"
                headerExtra={
                  onOpenPopup ? (
                    <button
                      type="button"
                      onClick={() => onOpenPopup(panel.id)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 border border-slate-200 text-slate-700 hover:bg-white font-semibold shrink-0 inline-flex items-center gap-0.5"
                    >
                      <ExternalLink size={11} />
                      새창
                    </button>
                  ) : undefined
                }
                footer={
                  isMain && rankStrip ? (
                    <span className="text-[10px] text-slate-500">본문 집중 뷰</span>
                  ) : undefined
                }
              >
                {renderPanelContent(panel.id, content)}
              </PatentFramePanel>
            </div>
            {idx < panels.length - 1 && (
              <PanelResizeHandle active={editMode} onResize={(dx) => handleResize(panel.id, dx)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PatentMultiFaceCanvas({
  categoryFrame,
  mainFrame,
  aiFrame,
  adFrame,
  fitFrame,
  rankStrip,
  layout,
  windowConfig,
  editMode = false,
  uiEditMode = false,
  onLayoutChange,
  onWindowConfigChange,
  onOpenPopup,
  popupPanel,
  onClosePopup,
}: Props) {
  const content: PanelContent = { categoryFrame, mainFrame, aiFrame, adFrame, fitFrame, rankStrip };
  const desktopPanels = visiblePanelsOrdered(layout.panels);
  const mobilePanels = desktopPanels.filter((p) => p.id !== "ad");
  const [mobileFace, setMobileFace] = useState<MobileFace>(mobilePanels[1]?.id ?? "main");
  const activeMobile = mobilePanels.find((p) => p.id === mobileFace) ?? mobilePanels[0];

  const panelContentMap: Record<EncyclopediaPanelId, React.ReactNode | undefined> = {
    category: categoryFrame,
    main: mainFrame,
    ai: aiFrame,
    ad: adFrame,
    fit: fitFrame,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full h-full overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)] p-2 md:p-3 lg:p-4 flex flex-col">
        {/* Desktop: 윈도우 데스크톱 */}
        {onWindowConfigChange && (
          <EncyclopediaWindowDesktop
            layout={layout}
            windowConfig={windowConfig}
            uiEditMode={uiEditMode}
            content={panelContentMap}
            mainFooter={
              rankStrip ? <span className="text-[10px] text-slate-500">본문 집중 뷰</span> : undefined
            }
            onWindowConfigChange={onWindowConfigChange}
            onOpenPopup={(id) => onOpenPopup?.(id)}
          />
        )}

        {/* Tablet: 그리드 폴백 */}
        <div className="hidden md:flex lg:hidden flex-1 min-h-0 overflow-hidden">
          <GridLayoutRow
            panels={desktopPanels}
            editMode={editMode}
            layout={layout}
            onLayoutChange={onLayoutChange}
            content={content}
            rankStrip={rankStrip}
            onOpenPopup={onOpenPopup}
          />
        </div>

        {/* Mobile */}
        <div className="md:hidden flex flex-col flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden">
          <div className="flex gap-1 p-1 rounded-xl bg-white/80 border border-slate-200 mb-2 shrink-0 overflow-x-auto">
            {mobilePanels.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMobileFace(p.id)}
                className={cn(
                  "shrink-0 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors",
                  mobileFace === p.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeMobile && (
              <PatentFramePanel
                title={PANEL_META[activeMobile.id].title}
                icon={PANEL_META[activeMobile.id].icon}
                accent={PANEL_META[activeMobile.id].accent}
                minWidth={0}
                scrollMode={activeMobile.scrollMode}
                showScrollControls={false}
                className="h-full"
                headerExtra={
                  onOpenPopup ? (
                    <button
                      type="button"
                      onClick={() => onOpenPopup(activeMobile.id)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 border border-slate-200 font-semibold inline-flex items-center gap-0.5"
                    >
                      <ExternalLink size={11} />
                      새창
                    </button>
                  ) : undefined
                }
              >
                {renderPanelContent(activeMobile.id, content)}
              </PatentFramePanel>
            )}
          </div>
        </div>
      </div>

      {rankStrip && <div className="shrink-0 overflow-x-auto lg:hidden">{rankStrip}</div>}

      {popupPanel && onClosePopup && (
        <EncyclopediaPanelPopup
          panelId={popupPanel}
          scrollMode={layout.panels.find((p) => p.id === popupPanel)?.scrollMode ?? "scroll"}
          onClose={onClosePopup}
        >
          {panelContentMap[popupPanel]}
        </EncyclopediaPanelPopup>
      )}
    </div>
  );
}
