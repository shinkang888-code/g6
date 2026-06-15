"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getDDay } from "@/lib/utils";
import type { CaseItem } from "@/lib/types";
import { Eye, MessageSquare, FolderOpen, AlertTriangle, Zap } from "lucide-react";
import { openCaseQuickView } from "@/lib/caseQuickPopup";

interface PriorityCardProps {
  cases: CaseItem[];
  type: "today" | "3days" | "7days";
}

const LONG_PRESS_MS = 480;

const cardConfig = {
  today: {
    title: "오늘 기일",
    subtitle: "D-Day",
    bgClass: "bg-gradient-to-br from-danger-600 to-danger-700",
    borderClass: "border-danger-500/30",
    textClass: "text-white",
    subtitleClass: "text-danger-100",
    countBg: "bg-white/20",
    isGlow: true,
  },
  "3days": {
    title: "3일 이내",
    subtitle: "D-3",
    bgClass: "bg-gradient-to-br from-warning-500 to-warning-600",
    borderClass: "border-warning-400/30",
    textClass: "text-white",
    subtitleClass: "text-warning-100",
    countBg: "bg-white/20",
    isGlow: false,
  },
  "7days": {
    title: "7일 이내",
    subtitle: "D-7",
    bgClass: "bg-gradient-to-br from-primary-600 to-primary-700",
    borderClass: "border-primary-500/30",
    textClass: "text-white",
    subtitleClass: "text-primary-100",
    countBg: "bg-white/20",
    isGlow: false,
  },
};

export function PriorityCard({ cases, type }: PriorityCardProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [actionBarId, setActionBarId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const config = cardConfig[type];

  const filteredCases = cases.filter((c) => {
    if (!c.nextDate) return false;
    const dday = getDDay(c.nextDate);
    if (type === "today") return dday <= 0;
    if (type === "3days") return dday > 0 && dday <= 3;
    return dday > 3 && dday <= 7;
  });

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const showActionBar = (id: string) => {
    setActionBarId(id);
    setHoveredId(id);
  };

  const hideActionBar = () => {
    setActionBarId(null);
    setHoveredId(null);
  };

  const startLongPress = (id: string) => {
    clearLongPressTimer();
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      showActionBar(id);
    }, LONG_PRESS_MS);
  };

  const endLongPress = () => {
    clearLongPressTimer();
  };

  const openQuickView = (c: CaseItem, view: "dates" | "memo" | "files") => {
    if (!c.id) return;
    openCaseQuickView(c.id, view, c.caseNumber);
    hideActionBar();
  };

  return (
    <div
      className={cn(
        "rounded-2xl p-5 border relative overflow-hidden",
        config.bgClass,
        config.borderClass,
        config.isGlow && filteredCases.length > 0 && "danger-pulse"
      )}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-4 -top-4 w-32 h-32 rounded-full bg-white/30" />
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/20" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className={cn("text-xs font-medium uppercase tracking-wider mb-0.5", config.subtitleClass)}>
              {config.subtitle}
            </div>
            <div className={cn("text-2xl font-bold", config.textClass)}>
              {filteredCases.length}
              <span className={cn("text-sm font-normal ml-1", config.subtitleClass)}>건</span>
            </div>
            <div className={cn("text-sm font-semibold mt-0.5", config.textClass)}>{config.title}</div>
          </div>
          {type === "today" && filteredCases.length > 0 && (
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <AlertTriangle size={18} className="text-white" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          {filteredCases.length === 0 ? (
            <div className={cn("text-sm text-center py-3", config.subtitleClass)}>
              해당 기일 없음
            </div>
          ) : (
            filteredCases.slice(0, 3).map((c) => {
              const menuOpen = hoveredId === c.id || actionBarId === c.id;
              return (
                <div
                  key={c.id}
                  className="relative"
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => {
                    if (actionBarId !== c.id) setHoveredId(null);
                  }}
                >
                  <div
                    className={cn(
                      "bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2.5 select-none touch-manipulation",
                      "transition-all duration-200 hover:bg-white/25",
                      menuOpen && "bg-white/25"
                    )}
                    onTouchStart={() => startLongPress(c.id)}
                    onTouchEnd={endLongPress}
                    onTouchCancel={endLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      showActionBar(c.id);
                    }}
                    onClick={() => {
                      if (longPressTriggered.current) {
                        longPressTriggered.current = false;
                        return;
                      }
                      openQuickView(c, "dates");
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {c.isElectronic && <Zap size={12} className="text-yellow-200 flex-shrink-0" />}
                        <span className={cn("text-sm font-semibold truncate", config.textClass)}>
                          {c.caseNumber}
                        </span>
                      </div>
                      <span className={cn("text-xs flex-shrink-0 ml-2", config.subtitleClass)}>
                        {c.nextDateType}
                      </span>
                    </div>
                    <div className={cn("text-xs truncate mt-0.5", config.subtitleClass)}>
                      {c.clientName} · {c.court}
                    </div>
                  </div>

                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm rounded-b-lg px-2 py-1.5 flex items-center gap-1 z-20"
                        onMouseLeave={() => {
                          if (actionBarId === c.id) hideActionBar();
                          else setHoveredId(null);
                        }}
                      >
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-white/80 hover:text-white py-0.5 rounded hover:bg-white/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            openQuickView(c, "dates");
                          }}
                        >
                          <Eye size={11} /> 상세
                        </button>
                        <div className="w-px h-3 bg-white/20" />
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-white/80 hover:text-white py-0.5 rounded hover:bg-white/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            openQuickView(c, "memo");
                          }}
                        >
                          <MessageSquare size={11} /> 메모
                        </button>
                        <div className="w-px h-3 bg-white/20" />
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-white/80 hover:text-white py-0.5 rounded hover:bg-white/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            openQuickView(c, "files");
                          }}
                        >
                          <FolderOpen size={11} /> 자료
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {filteredCases.length > 3 && (
          <div className={cn("text-xs text-center mt-2 cursor-pointer hover:underline", config.subtitleClass)}>
            +{filteredCases.length - 3}건 더 보기
          </div>
        )}
      </div>
    </div>
  );
}
