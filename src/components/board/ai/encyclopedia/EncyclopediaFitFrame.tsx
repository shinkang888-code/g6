// filepath: src/components/board/ai/encyclopedia/EncyclopediaFitFrame.tsx
"use client";

import { BookOpen, Database, Eye, Layers, Sparkles } from "lucide-react";
import type { EncyclopediaSearchResult } from "@/lib/legalEncyclopedia/types";

type FitMeta = {
  dbReady?: boolean;
  stats?: {
    vectorCount?: number;
    documentCount?: number;
    usageCount?: number;
  };
};

type Props = {
  meta: FitMeta | null;
  searchResult: EncyclopediaSearchResult | null;
  keyword: string;
};

/** 세로·가로 스크롤 없이 뷰포트에 맞춰 표시되는 고정 요약 프레임 */
export function EncyclopediaFitFrame({ meta, searchResult, keyword }: Props) {
  const docCount = searchResult?.documents.length ?? 0;
  const topDoc = searchResult?.documents[0];

  return (
    <div className="h-full flex flex-col justify-between gap-2 overflow-hidden p-1">
      <div className="rounded-xl bg-gradient-to-br from-slate-800 to-indigo-900 text-white p-3 shrink-0">
        <p className="text-[10px] uppercase tracking-wider opacity-70">고정 프레임</p>
        <p className="text-sm font-bold mt-0.5 truncate">{keyword.trim() || "키워드 대기"}</p>
        <p className="text-[11px] opacity-80 mt-1 line-clamp-2">
          {searchResult ? `${docCount}건 순위화 · ${searchResult.domain}` : "검색 후 요약 표시"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/80 p-2 text-center">
          <Database size={14} className="mx-auto text-indigo-600 mb-0.5" />
          <p className="text-[10px] text-slate-500">vectors</p>
          <p className="text-sm font-bold text-indigo-900 tabular-nums">{meta?.stats?.vectorCount ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-violet-100 bg-violet-50/80 p-2 text-center">
          <BookOpen size={14} className="mx-auto text-violet-600 mb-0.5" />
          <p className="text-[10px] text-slate-500">docs</p>
          <p className="text-sm font-bold text-violet-900 tabular-nums">{meta?.stats?.documentCount ?? "—"}</p>
        </div>
      </div>

      {topDoc ? (
        <div className="flex-1 min-h-0 rounded-xl border border-amber-100 bg-amber-50/60 p-2 overflow-hidden">
          <p className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
            <Eye size={11} /> 1위 문서
          </p>
          <p className="text-xs font-semibold text-slate-800 mt-1 line-clamp-2 leading-snug">{topDoc.title}</p>
          <p className="text-[10px] text-slate-600 mt-1 line-clamp-3 leading-relaxed">{topDoc.summary}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center text-slate-400 px-2">
          <Layers size={20} className="mb-1 opacity-40" />
          <p className="text-[11px] leading-snug">스크롤 없음 · 화면 크기에 맞춤</p>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-1 text-[10px] text-slate-500">
        <Sparkles size={11} className="text-indigo-500" />
        <span className="truncate">다면 UI · fit</span>
      </div>
    </div>
  );
}
