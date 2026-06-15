// filepath: src/components/board/ai/encyclopedia/EncyclopediaPanelPopup.tsx
"use client";

import { X } from "lucide-react";
import type { EncyclopediaPanelId } from "@/lib/legalEncyclopedia/layoutConfig";
import { PANEL_META } from "@/components/board/ai/encyclopedia/panelMeta";

type Props = {
  panelId: EncyclopediaPanelId;
  scrollMode: "scroll" | "none";
  children: React.ReactNode;
  onClose: () => void;
};

export function EncyclopediaPanelPopup({ panelId, scrollMode, children, onClose }: Props) {
  const meta = PANEL_META[panelId];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.shortLabel} 새 창`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-6xl h-[min(92vh,920px)] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200 bg-white">
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <div className="flex items-center gap-2 min-w-0">
            {meta.desktopIcon}
            <span className="font-semibold text-sm truncate">{meta.title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            aria-label="창 닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
