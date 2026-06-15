// filepath: src/components/board/ai/encyclopedia/EncyclopediaMainFrame.tsx
"use client";

import {
  BookOpen,
  Calendar,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  MapPin,
  Scale,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isValidPrecedentCaseNumber,
  openPrecedentExternalTab,
  openPrecedentOriginalPopup,
} from "@/lib/precedentLinks";
import { buildLawGoKrArticleUrl, buildLawGoKrLawSearchUrl } from "@/lib/lawLinks";
import type { EncyclopediaCategory, RankedLegalDocument } from "@/lib/legalEncyclopedia/types";
import {
  EncyclopediaPagination,
  PAGE_SIZE,
  paginateDocuments,
} from "@/components/board/ai/encyclopedia/EncyclopediaPagination";
import { useEffect, useState } from "react";

const CATEGORY_LABELS: Record<EncyclopediaCategory, string> = {
  판례: "판례",
  법령: "법령",
  서식: "서식",
  기타자료: "기타자료",
  관련법률문서: "관련 법률문서",
};

type Props = {
  category: EncyclopediaCategory | "전체";
  keyword: string;
  documents: RankedLegalDocument[];
  selectedIndex: number;
  loading: boolean;
  hasSearched: boolean;
  onSelect: (index: number) => void;
};

function ViewCountBadge({ count }: { count: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border",
        count > 0 ? "bg-amber-50 text-amber-800 border-amber-100" : "bg-slate-50 text-slate-400 border-slate-100"
      )}
      title="회원 조회수"
    >
      <Eye size={10} />
      {count}
    </span>
  );
}

function resolveExternalUrl(doc: RankedLegalDocument): string | null {
  if (doc.meta?.externalUrl) return doc.meta.externalUrl;
  if (doc.category === "법령" && doc.meta?.lawName) {
    if (doc.meta.articleNo) {
      return buildLawGoKrArticleUrl(doc.meta.lawName, doc.meta.articleNo, doc.meta.articleSub);
    }
    return buildLawGoKrLawSearchUrl(doc.meta.lawName);
  }
  return null;
}

export function openDocumentExternal(doc: RankedLegalDocument): void {
  if (doc.category === "판례" && doc.meta?.caseNumber && isValidPrecedentCaseNumber(doc.meta.caseNumber)) {
    openPrecedentExternalTab(doc.meta.caseNumber);
    return;
  }
  const url = resolveExternalUrl(doc);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

function PrecedentCard({
  doc,
  idx,
  selected,
  onSelect,
}: {
  doc: RankedLegalDocument;
  idx: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const caseNumber = doc.meta?.caseNumber;
  const canOpen = caseNumber && isValidPrecedentCaseNumber(caseNumber);

  return (
    <article
      className={cn(
        "rounded-xl border bg-white shadow-sm transition-all overflow-hidden",
        selected ? "border-violet-400 ring-2 ring-violet-500/15" : "border-slate-200 hover:border-violet-200 hover:shadow-md"
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left px-4 py-3.5 flex items-start gap-3">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex flex-col items-center justify-center text-[10px] font-bold">
          <span>#{idx + 1}</span>
          <span className="text-[8px] opacity-80">{doc.rankingScore}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {canOpen ? (
              <span className="font-bold text-violet-800 text-sm">{caseNumber}</span>
            ) : (
              <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">{doc.title}</h4>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">판례</span>
            {doc.source === "국가법령정보센터" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">공식 API</span>
            )}
            <ViewCountBadge count={doc.viewCount ?? 0} />
          </div>
          <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{doc.summary}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
            {doc.meta?.court && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin size={10} /> {doc.meta.court}
              </span>
            )}
            {doc.meta?.judgmentDate && (
              <span className="inline-flex items-center gap-0.5">
                <Calendar size={10} /> {doc.meta.judgmentDate}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className={cn("shrink-0 mt-1", selected ? "text-violet-600" : "text-slate-300")} />
      </button>

      {selected && (
        <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50/40">
          <p className="text-[15px] text-slate-800 leading-[1.85] whitespace-pre-wrap pt-4">{doc.body}</p>
          {canOpen && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => openPrecedentExternalTab(caseNumber!)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700"
              >
                <ExternalLink size={12} />
                국가법령정보센터 원문
              </button>
              <button
                type="button"
                onClick={() =>
                  openPrecedentOriginalPopup(caseNumber!, {
                    date: doc.meta?.judgmentDate,
                    court: doc.meta?.court,
                    issueSummary: doc.summary,
                    bodySummary: doc.body.slice(0, 2000),
                    fullText: doc.body,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-200 text-violet-800 bg-white hover:bg-violet-50"
              >
                판례 뷰어
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function LawCard({
  doc,
  idx,
  selected,
  onSelect,
}: {
  doc: RankedLegalDocument;
  idx: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-white shadow-sm transition-all",
        selected ? "border-blue-400 ring-2 ring-blue-500/15" : "border-slate-200 hover:border-blue-200"
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left px-4 py-3.5 flex items-start gap-3">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white flex items-center justify-center">
          <ScrollText size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-900 text-sm">{doc.meta?.lawName ?? doc.title}</h4>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-600 flex-1">{doc.summary}</p>
            <ViewCountBadge count={doc.viewCount ?? 0} />
          </div>
        </div>
      </button>
      {selected && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <p className="text-[15px] text-slate-800 pt-4 leading-[1.85]">{doc.body}</p>
          <button
            type="button"
            onClick={() => openDocumentExternal(doc)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
          >
            <ExternalLink size={12} />
            국가법령정보센터에서 보기
          </button>
        </div>
      )}
    </article>
  );
}

function GenericDocCard({
  doc,
  idx,
  selected,
  onSelect,
}: {
  doc: RankedLegalDocument;
  idx: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-white shadow-sm transition-all cursor-pointer",
        selected ? "border-indigo-300 ring-2 ring-indigo-500/10" : "border-slate-100 hover:border-indigo-200"
      )}
      onClick={onSelect}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex flex-col items-center justify-center text-[10px] font-bold">
          <span>#{idx + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-slate-900 text-sm">{doc.title}</h4>
            <ViewCountBadge count={doc.viewCount ?? 0} />
          </div>
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{doc.summary}</p>
        </div>
      </div>
      {selected && (
        <div className="px-5 py-4 text-[15px] text-slate-800 leading-[1.85] whitespace-pre-wrap border-t border-slate-50 bg-slate-50/30">
          {doc.body}
        </div>
      )}
    </article>
  );
}

export function EncyclopediaMainFrame({
  category,
  keyword,
  documents,
  selectedIndex,
  loading,
  hasSearched,
  onSelect,
}: Props) {
  const [page, setPage] = useState(1);
  const activeCategory = category === "전체" ? null : category;
  const titleSuffix = activeCategory ? CATEGORY_LABELS[activeCategory] : "순위화 법률문서";

  useEffect(() => {
    setPage(1);
  }, [keyword, category, documents.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(documents.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [documents.length, page]);

  const pageDocs = paginateDocuments(documents, page);
  const pageOffset = (page - 1) * PAGE_SIZE;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-indigo-600 py-16">
        <Loader2 size={36} className="animate-spin" />
        <p className="text-base font-medium">「{keyword}」 {titleSuffix} 검색 중…</p>
        <p className="text-xs text-slate-500">110 키워드검색 → 235 순위화 파이프라인</p>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-slate-500 px-6 py-16">
        <BookOpen size={56} className="text-indigo-200 mb-5" />
        <h2 className="text-xl font-bold text-slate-800 mb-3">로이고 법률백과</h2>
        <p className="text-[15px] max-w-lg leading-relaxed">
          특허 다면 UI(도7·도8) — 좌측 종류 프레임에서 분류를 선택하고 키워드를 검색하면 본문 프레임에{" "}
          {titleSuffix}가 순위화되어 표시됩니다.
        </p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-slate-500 px-6 py-16">
        <Scale size={40} className="text-slate-300" />
        <p className="text-base font-medium text-slate-700 mt-4">「{keyword}」 {titleSuffix} 결과가 없습니다</p>
        <p className="text-sm mt-2 max-w-md leading-relaxed">다른 종류를 선택하거나 키워드를 바꿔 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {documents.length > PAGE_SIZE && (
        <p className="text-xs text-indigo-800 bg-indigo-50/80 border border-indigo-100 rounded-xl px-4 py-3 leading-relaxed">
          조회수·순위점수가 높은 문서가 상단에 배치됩니다 · 페이지당 {PAGE_SIZE}건 · 하단 스트립에서 순위 이동
        </p>
      )}
      {activeCategory === "판례" && (
        <p className="text-xs text-violet-800 bg-violet-50/80 border border-violet-100 rounded-xl px-4 py-3">
          판례 항목 클릭 → 국가법령정보센터 원문 · 선택 시 전문·뷰어 버튼 표시
        </p>
      )}
      <div className="space-y-5">
        {pageDocs.map((doc, idx) => {
          const globalIdx = pageOffset + idx;
          const selected = globalIdx === selectedIndex;
          if (doc.category === "판례") {
            return (
              <PrecedentCard
                key={doc.id}
                doc={doc}
                idx={globalIdx}
                selected={selected}
                onSelect={() => {
                  onSelect(globalIdx);
                  if (doc.meta?.caseNumber && isValidPrecedentCaseNumber(doc.meta.caseNumber)) {
                    openPrecedentExternalTab(doc.meta.caseNumber);
                  }
                }}
              />
            );
          }
          if (doc.category === "법령") {
            return (
              <LawCard
                key={doc.id}
                doc={doc}
                idx={globalIdx}
                selected={selected}
                onSelect={() => onSelect(globalIdx)}
              />
            );
          }
          return (
            <GenericDocCard
              key={doc.id}
              doc={doc}
              idx={globalIdx}
              selected={selected}
              onSelect={() => onSelect(globalIdx)}
            />
          );
        })}
      </div>
      <EncyclopediaPagination total={documents.length} page={page} onPageChange={setPage} />
    </div>
  );
}
