// filepath: src/components/board/ai/encyclopedia/panelMeta.tsx
"use client";

import { BookOpen, Database, Layers, LayoutTemplate, Sparkles } from "lucide-react";
import type { EncyclopediaPanelId } from "@/lib/legalEncyclopedia/layoutConfig";

export type PanelMeta = {
  moduleId?: string;
  title: string;
  shortLabel: string;
  icon: React.ReactNode;
  desktopIcon: React.ReactNode;
  accent: "indigo" | "violet" | "blue" | "slate" | "amber";
  accentBg: string;
};

export const PANEL_META: Record<EncyclopediaPanelId, PanelMeta> = {
  category: {
    moduleId: "좌측",
    title: "종류·목차 프레임",
    shortLabel: "종류·목차",
    icon: <Layers size={14} className="text-indigo-600" />,
    desktopIcon: <Layers size={22} className="text-indigo-600" />,
    accent: "indigo",
    accentBg: "from-indigo-500 to-indigo-700",
  },
  main: {
    moduleId: "290",
    title: "본문 프레임 — 순위화 법률문서",
    shortLabel: "본문",
    icon: <Database size={14} className="text-blue-600" />,
    desktopIcon: <Database size={22} className="text-blue-600" />,
    accent: "blue",
    accentBg: "from-blue-500 to-blue-700",
  },
  ai: {
    moduleId: "310·320",
    title: "AI 프레임 — 사전·모범답안",
    shortLabel: "AI·모범답안",
    icon: <Sparkles size={14} className="text-violet-600" />,
    desktopIcon: <Sparkles size={22} className="text-violet-600" />,
    accent: "violet",
    accentBg: "from-violet-500 to-violet-700",
  },
  fit: {
    moduleId: "fit",
    title: "요약·고정 프레임 (스크롤 없음)",
    shortLabel: "요약·고정",
    icon: <LayoutTemplate size={14} className="text-emerald-600" />,
    desktopIcon: <LayoutTemplate size={22} className="text-emerald-600" />,
    accent: "slate",
    accentBg: "from-emerald-500 to-teal-700",
  },
  ad: {
    moduleId: "광고",
    title: "보조 프레임",
    shortLabel: "보조",
    icon: <BookOpen size={14} className="text-amber-600" />,
    desktopIcon: <BookOpen size={22} className="text-amber-600" />,
    accent: "amber",
    accentBg: "from-amber-500 to-orange-600",
  },
};
