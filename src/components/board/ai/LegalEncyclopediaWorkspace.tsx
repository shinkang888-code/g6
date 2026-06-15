// filepath: src/components/board/ai/LegalEncyclopediaWorkspace.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
  Search,
  Scale,
  FileText,
  ScrollText,
  FolderOpen,
  ArrowRight,
  GraduationCap,
  HardDrive,
  PenLine,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ENCYCLOPEDIA_CATEGORIES } from "@/lib/legalEncyclopedia/pipeline";
import { ProjectSelector, type EncyclopediaProjectOption } from "@/components/board/ai/encyclopedia/ProjectSelector";
import { FeatureDock } from "@/components/board/ai/encyclopedia/FeatureDock";
import { EncyclopediaMainFrame } from "@/components/board/ai/encyclopedia/EncyclopediaMainFrame";
import { EncyclopediaAdPanel } from "@/components/board/ai/encyclopedia/EncyclopediaAdPanel";
import { EncyclopediaRankStrip } from "@/components/board/ai/encyclopedia/EncyclopediaRankStrip";
import { PatentMultiFaceCanvas } from "@/components/board/ai/encyclopedia/PatentMultiFaceCanvas";
import { PAGE_SIZE } from "@/components/board/ai/encyclopedia/EncyclopediaPagination";
import { EncyclopediaFitFrame } from "@/components/board/ai/encyclopedia/EncyclopediaFitFrame";
import { EncyclopediaLayoutToolbar } from "@/components/board/ai/encyclopedia/EncyclopediaLayoutToolbar";
import { EncyclopediaPanelPopup } from "@/components/board/ai/encyclopedia/EncyclopediaPanelPopup";
import {
  defaultLayoutConfig,
  loadLayoutConfig,
  reorderPanels,
  resetLayoutConfig,
  saveLayoutConfig,
  type EncyclopediaLayoutConfig,
  type EncyclopediaPanelId,
} from "@/lib/legalEncyclopedia/layoutConfig";
import {
  loadWindowConfig,
  resetWindowConfig,
  saveWindowConfig,
  type EncyclopediaWindowConfig,
} from "@/lib/legalEncyclopedia/windowManager";
import type {
  DictionarySection,
  EncyclopediaCategory,
  EncyclopediaSearchResult,
  EncyclopediaViewMode,
  FeatureValue,
  LegalDomain,
  ModelAnswerResult,
  PipelineStep,
  RankedLegalDocument,
  SemanticVector,
} from "@/lib/legalEncyclopedia/types";

const DOMAIN_OPTIONS: LegalDomain[] = [
  "전체",
  "민법",
  "형법",
  "상법",
  "민사소송법",
  "형사소송법",
  "헌법",
  "행정법",
  "기업법무",
];

type EncyclopediaMeta = {
  dbReady: boolean;
  stats?: {
    vectorCount: number;
    documentCount: number;
    usageCount: number;
    ontologySeedCount?: number;
    topWeights?: { feature_label: string; weight: number; selection_count: number }[];
  };
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  판례: <Scale size={14} />,
  법령: <ScrollText size={14} />,
  서식: <FileText size={14} />,
  기타자료: <FolderOpen size={14} />,
  관련법률문서: <BookOpen size={14} />,
};

function PipelineBar({ steps, compact }: { steps: PipelineStep[]; compact?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact ? "text-[10px]" : "text-xs")}>
      {steps.map((s) => (
        <span
          key={s.moduleId}
          title={s.summary}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border",
            s.status === "done"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-slate-50 border-slate-200 text-slate-600"
          )}
        >
          <span className="font-mono opacity-60">{s.moduleId}</span>
          <span className="font-medium">{s.moduleName}</span>
        </span>
      ))}
    </div>
  );
}

function VectorChip({ v }: { v: SemanticVector }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-2 py-1.5 text-[10px]">
      <div className="font-medium text-indigo-900 truncate max-w-[120px]">{v.token}</div>
      <div className="text-indigo-600 font-mono mt-0.5">|v|={v.magnitude}</div>
    </div>
  );
}

export function LegalEncyclopediaWorkspace() {
  const [keyword, setKeyword] = useState("");
  const [detail, setDetail] = useState("");
  const [category, setCategory] = useState<EncyclopediaCategory | "전체">("전체");
  const [viewMode, setViewMode] = useState<EncyclopediaViewMode>("search");
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<EncyclopediaSearchResult | null>(null);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [selectedSection, setSelectedSection] = useState<DictionarySection | null>(null);
  const [modelAnswer, setModelAnswer] = useState<ModelAnswerResult | null>(null);
  const [showPipeline, setShowPipeline] = useState(true);
  const [meta, setMeta] = useState<EncyclopediaMeta | null>(null);
  const [learnedWeights, setLearnedWeights] = useState<Record<string, number>>({});
  const [project, setProject] = useState<EncyclopediaProjectOption | null>(null);
  const projectId = project?.id ?? null;

  const [layout, setLayout] = useState<EncyclopediaLayoutConfig>(defaultLayoutConfig);
  const [windowConfig, setWindowConfig] = useState<EncyclopediaWindowConfig>(() => loadWindowConfig());
  const [editMode, setEditMode] = useState(false);
  const [uiEditMode, setUiEditMode] = useState(false);
  const [popupPanel, setPopupPanel] = useState<EncyclopediaPanelId | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);

  useEffect(() => {
    setLayout(loadLayoutConfig());
    setWindowConfig(loadWindowConfig());
    setLayoutReady(true);
  }, []);

  const handleSaveLayout = useCallback(() => {
    saveLayoutConfig(layout);
    setEditMode(false);
    toast.success("메뉴·프레임 레이아웃을 저장했습니다.");
  }, [layout]);

  const handleResetLayout = useCallback(() => {
    setLayout(resetLayoutConfig());
    toast.success("기본 레이아웃으로 초기화했습니다.");
  }, []);

  const handleReorderPanels = useCallback((from: number, to: number) => {
    setLayout((prev) => ({ ...prev, panels: reorderPanels(prev.panels, from, to) }));
  }, []);

  const handleTogglePanelVisible = useCallback((id: EncyclopediaLayoutConfig["panels"][0]["id"]) => {
    setLayout((prev) => ({
      ...prev,
      panels: prev.panels.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)),
    }));
  }, []);

  const handleSaveUiLayout = useCallback(() => {
    saveWindowConfig(windowConfig);
    setUiEditMode(false);
    toast.success("윈도우 UI 레이아웃을 저장했습니다.");
  }, [windowConfig]);

  const handleResetUiLayout = useCallback(() => {
    setWindowConfig(resetWindowConfig());
    toast.success("윈도우 UI를 기본값으로 초기화했습니다.");
  }, []);

  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestText, setIngestText] = useState("");
  const [ingestDomain, setIngestDomain] = useState<LegalDomain>("민법");
  const [ingestLoading, setIngestLoading] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const url = projectId
        ? `/api/encyclopedia/projects/${projectId}`
        : "/api/ai/legal-encyclopedia";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (projectId && data.stats) {
        setMeta({
          dbReady: true,
          stats: {
            vectorCount: data.stats.vectorCount,
            documentCount: data.stats.documentCount,
            usageCount: data.stats.artifactCount ?? 0,
          },
        });
      } else {
        setMeta(data as EncyclopediaMeta);
      }
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const recordSelection = useCallback(
    async (payload: {
      selectionType: string;
      vectorId?: string;
      sectionId?: string;
      sectionTitle?: string;
      rankingScore?: number;
      features?: FeatureValue[];
    }) => {
      if (!searchResult) return;
      try {
        const res = await fetch("/api/ai/legal-encyclopedia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        body: JSON.stringify({
          action: "record_selection",
          keyword: searchResult.keyword,
          projectId,
          features: payload.features ?? searchResult.features,
          ...payload,
        }),
        });
        const data = await res.json();
        if (data.learnedWeights) setLearnedWeights(data.learnedWeights);
      } catch {
        /* offline ok */
      }
    },
    [searchResult, projectId]
  );

  const handleSearch = useCallback(async (categoryOverride?: EncyclopediaCategory | "전체") => {
    const kw = keyword.trim();
    if (!kw) {
      toast.error("검색 키워드를 입력하세요.");
      return;
    }
    const searchCategory = categoryOverride ?? category;
    setLoading(true);
    setModelAnswer(null);
    setSelectedSection(null);
    try {
      const res = await fetch("/api/ai/legal-encyclopedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "search", keyword: kw, category: searchCategory, detail: detail.trim() || undefined, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색 실패");
      setSearchResult(data as EncyclopediaSearchResult);
      setSelectedDocIndex(0);
      setViewMode("search");
      await loadMeta();
      const n = data.documents?.length ?? 0;
      const catLabel = searchCategory === "전체" ? "" : ` · ${searchCategory}`;
      toast.success(`순위화 완료${catLabel} — ${n}건`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "검색 중 오류");
    } finally {
      setLoading(false);
    }
  }, [keyword, category, detail, loadMeta, projectId]);

  const handleCategorySelect = useCallback(
    (c: EncyclopediaCategory) => {
      setCategory(c);
      if (keyword.trim()) void handleSearch(c);
    },
    [keyword, handleSearch]
  );

  const handleSelectDoc = useCallback(
    (idx: number) => {
      setSelectedDocIndex(idx);
      const doc = searchResult?.documents[idx];
      if (doc) {
        recordSelection({
          selectionType: "select_document",
          vectorId: doc.vectorId,
          rankingScore: doc.rankingScore,
          features: doc.features.length > 0 ? doc.features : searchResult?.features,
        });
        if (doc.documentKey) {
          void fetch("/api/encyclopedia/document-view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              documentKey: doc.documentKey,
              title: doc.title,
              category: doc.category,
              vectorId: doc.vectorId,
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.viewCount == null || !searchResult) return;
              setSearchResult((prev) =>
                prev
                  ? {
                      ...prev,
                      documents: prev.documents.map((d) =>
                        d.documentKey === doc.documentKey ? { ...d, viewCount: data.viewCount } : d
                      ),
                    }
                  : null
              );
            })
            .catch(() => {
              /* offline ok */
            });
        }
      }
    },
    [searchResult, recordSelection]
  );

  const handleSelectSection = useCallback(
    async (section: DictionarySection) => {
      if (!searchResult) return;
      setSelectedSection(section);
      setViewMode("detail");
      recordSelection({
        selectionType: "select_section",
        sectionId: section.id,
        sectionTitle: section.title,
      });
      setModelLoading(true);
      try {
        const relatedDocs = searchResult.documents.filter((d) => section.vectorIds.includes(d.vectorId));
        const res = await fetch("/api/ai/legal-encyclopedia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "model_answer",
            keyword: searchResult.keyword,
            sectionId: section.id,
            sectionTitle: section.title,
            documents: relatedDocs.length > 0 ? relatedDocs : searchResult.documents.slice(0, 4),
            features: searchResult.features,
            projectId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "모범답안 생성 실패");
        setModelAnswer(data as ModelAnswerResult);
        if (data.repetitiveResolution) {
          toast.success("반복해결 매커니즘 — 목적함수벡터 확정");
        }
        await loadMeta();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "모범답안 생성 오류");
      } finally {
        setModelLoading(false);
      }
    },
    [searchResult, recordSelection, loadMeta]
  );

  const handleIngest = useCallback(async () => {
    if (!projectId) {
      toast.error("프로젝트를 먼저 선택하세요.");
      return;
    }
    const text = ingestText.trim();
    if (!text || text.length < 50) {
      toast.error("법률문서 본문을 50자 이상 입력하세요.");
      return;
    }
    setIngestLoading(true);
    try {
      const res = await fetch("/api/ai/legal-encyclopedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "ingest",
          title: ingestTitle.trim() || "업로드 법률문서",
          text,
          domain: ingestDomain,
          category: "관련법률문서",
          projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      toast.success(data.message ?? "벡터 저장 완료");
      setIngestText("");
      await loadMeta();
      if (keyword.trim()) await handleSearch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ingest 오류");
    } finally {
      setIngestLoading(false);
    }
  }, [ingestText, ingestTitle, ingestDomain, loadMeta, keyword, handleSearch, projectId]);

  const documents = searchResult?.documents ?? [];
  const activeDoc = documents[selectedDocIndex];
  const topWeights = meta?.stats?.topWeights ?? [];

  const openAiDraftInNewTab = useCallback(() => {
    const url = new URL("/board/ai/doc_draft", window.location.origin);
    if (projectId) url.searchParams.set("projectId", projectId);
    const kw = keyword.trim();
    if (kw) url.searchParams.set("keyword", kw);
    if (documents.length > 0) {
      const ctx = documents
        .slice(0, 3)
        .map((d) => `${d.title}\n${d.body.slice(0, 400)}`)
        .join("\n\n---\n\n");
      url.searchParams.set("context", ctx.slice(0, 1500));
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }, [projectId, keyword, documents]);

  return (
    <div className="flex flex-col flex-1 w-full min-w-0 h-full min-h-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* 110 검색 프레임 — 제목 옆 최상단 컴팩트 배치 */}
      <header className="shrink-0 border-b border-slate-200/80 bg-white/98 backdrop-blur-md px-3 md:px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href="/board"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 shrink-0"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">게시판</span>
          </Link>
          <h1 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-1.5 shrink-0">
            <Sparkles size={18} className="text-indigo-500" />
            로이고 법률백과
          </h1>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 shrink-0">
            110
          </span>

          <div className="flex flex-1 min-w-[min(100%,280px)] items-center gap-2">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="법률 키워드"
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 outline-none bg-white"
            />
            <Button
              size="sm"
              onClick={() => handleSearch()}
              disabled={loading}
              leftIcon={loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            >
              검색
            </Button>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="추가 질의"
              className="w-28 sm:w-36 md:w-44 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none bg-white hidden sm:block"
            />
          </div>

          <div className="flex flex-wrap gap-1 w-full sm:w-auto sm:ml-0">
            {ENCYCLOPEDIA_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory(c.id);
                  if (c.id !== "전체" && keyword.trim()) void handleSearch(c.id);
                  else if (c.id === "전체" && keyword.trim()) void handleSearch("전체");
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                  category === c.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {searchResult && (
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-600">210 온톨로지:</span>
            {searchResult.synonyms.map((s) => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-medium">
                {s}
              </span>
            ))}
            <span className="text-xs text-slate-300">|</span>
            <span className="text-[11px] font-semibold text-slate-800">{searchResult.domain}</span>
            <button
              type="button"
              onClick={() => setShowPipeline((p) => !p)}
              className="ml-auto text-[11px] text-indigo-600 font-medium flex items-center gap-0.5"
            >
              파이프라인 {showPipeline ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        )}
        {showPipeline && searchResult?.pipeline && (
          <div className="overflow-x-auto mt-2 pb-0.5">
            <PipelineBar steps={searchResult.pipeline} />
          </div>
        )}
      </header>

      {layoutReady && (
        <EncyclopediaLayoutToolbar
          editMode={editMode}
          uiEditMode={uiEditMode}
          layout={layout}
          onToggleEdit={() => {
            setEditMode((v) => !v);
            if (!editMode) setUiEditMode(false);
          }}
          onToggleUiEdit={() => {
            setUiEditMode((v) => !v);
            if (!uiEditMode) setEditMode(false);
          }}
          onSave={handleSaveLayout}
          onSaveUi={handleSaveUiLayout}
          onReset={handleResetLayout}
          onResetUi={handleResetUiLayout}
          onReorder={handleReorderPanels}
          onToggleVisible={handleTogglePanelVisible}
        />
      )}

      <PatentMultiFaceCanvas
        layout={layout}
        windowConfig={windowConfig}
        editMode={editMode}
        uiEditMode={uiEditMode}
        onLayoutChange={setLayout}
        onWindowConfigChange={setWindowConfig}
        onOpenPopup={setPopupPanel}
        popupPanel={popupPanel}
        onClosePopup={() => setPopupPanel(null)}
        categoryFrame={
          <>
            <div className="mb-4 pb-4 border-b border-indigo-100/80">
              <ProjectSelector value={projectId} onChange={setProject} layout="stacked" />
            </div>
            {viewMode === "search"
              ? ENCYCLOPEDIA_CATEGORIES.filter((c) => c.id !== "전체").map((c) => {
                  const count = documents.filter((d) => d.category === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCategorySelect(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-3 rounded-xl text-sm flex items-center justify-between mb-1.5 transition-colors",
                        category === c.id
                          ? "bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-200"
                          : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {CATEGORY_ICONS[c.id]} {c.label}
                      </span>
                      {searchResult && (
                        <span className="text-xs tabular-nums text-slate-400 font-mono">{count}</span>
                      )}
                    </button>
                  );
                })
              : searchResult?.sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSelectSection(sec)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-xl text-sm mb-1",
                      selectedSection?.id === sec.id
                        ? "bg-indigo-50 text-indigo-900 font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                    style={{ paddingLeft: `${12 + (sec.path.length - 1) * 12}px` }}
                  >
                    <div className="leading-snug">{sec.title}</div>
                  </button>
                ))}
            {searchResult && viewMode === "search" && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setViewMode("detail")}
                  leftIcon={<ArrowRight size={12} />}
                >
                  상세·모범답안 보기
                </Button>
              </div>
            )}
            {viewMode === "detail" && (
              <div className="pt-2">
                <Button size="sm" variant="ghost" className="w-full" onClick={() => setViewMode("search")}>
                  ← 검색 결과로
                </Button>
              </div>
            )}
            {viewMode === "search" && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={openAiDraftInNewTab}
                  className="w-full text-left px-3 py-3 rounded-xl text-sm flex items-center justify-between gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-200/80 text-indigo-900 font-bold hover:from-violet-100 hover:to-indigo-100"
                >
                  <span className="flex items-center gap-2">
                    <PenLine size={15} />
                    AI초안작성
                  </span>
                  <ExternalLink size={13} className="opacity-50" />
                </button>
              </div>
            )}
          </>
        }
        mainFrame={
          <EncyclopediaMainFrame
            category={category}
            keyword={keyword}
            documents={documents}
            selectedIndex={selectedDocIndex}
            loading={loading}
            hasSearched={Boolean(searchResult)}
            onSelect={handleSelectDoc}
          />
        }
        aiFrame={
          <>
            <section className="mb-5 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/80 border border-indigo-100/90 space-y-2.5">
              <p className="text-xs text-indigo-950 font-semibold leading-relaxed">
                특허 기반 AI 딥러닝·순위화·온라인 법률정보사전·모범답안 (다면적 프레임 UI)
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-1.5">
                <Brain size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                특허 10-2019-0015797 · AI 딥러닝 + 순위화 + 벡터DB + 반복해결 학습
              </p>
              {meta?.dbReady ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-semibold w-fit">
                  <HardDrive size={12} /> DB 연결
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full w-fit">
                  DB 미연결
                </span>
              )}
            </section>

            {searchResult && (
              <section className="mb-5">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">220·270 자질값 · 의미벡터</h4>
                <div className="flex flex-wrap gap-1.5">
                  {searchResult.features.slice(0, 8).map((f: FeatureValue) => (
                    <span
                      key={f.id}
                      className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-800 font-medium"
                    >
                      {f.label}
                      {learnedWeights[f.label] && learnedWeights[f.label] > 1 && (
                        <span className="text-amber-600 ml-1 font-mono">×{learnedWeights[f.label].toFixed(2)}</span>
                      )}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {searchResult.vectors.slice(0, 6).map((v) => (
                    <VectorChip key={v.id} v={v} />
                  ))}
                </div>
              </section>
            )}

            {(topWeights.length > 0 || Object.keys(learnedWeights).length > 0) && (
              <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 mb-5">
                <h4 className="text-[11px] font-bold text-amber-900 uppercase mb-3 flex items-center gap-1.5">
                  <GraduationCap size={13} /> 253 반복해결 · 학습 가중치
                </h4>
                <div className="space-y-2">
                  {(topWeights.length > 0
                    ? topWeights
                    : Object.entries(learnedWeights).map(([feature_label, weight]) => ({
                        feature_label,
                        weight,
                        selection_count: 0,
                      }))
                  )
                    .slice(0, 8)
                    .map((w) => (
                      <div key={w.feature_label} className="flex justify-between text-xs text-slate-800">
                        <span className="font-medium">{w.feature_label}</span>
                        <span className="font-mono text-amber-800 font-bold">{Number(w.weight).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </section>
            )}

            <section>
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                310 모범답안
                {modelLoading && <Loader2 size={14} className="animate-spin text-indigo-500" />}
              </h4>
              {modelAnswer ? (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-indigo-950 leading-snug">{modelAnswer.title}</div>
                  {modelAnswer.repetitiveResolution && (
                    <div className="text-xs text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl font-medium">
                      254 목적함수벡터 · 반복해결 매커니즘 활성
                    </div>
                  )}
                  {modelAnswer.blocks.map((block) => (
                    <div key={block.id} className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                      <div className="text-sm font-bold text-indigo-900 mb-2">{block.sectionTitle}</div>
                      <ul className="text-[13px] text-slate-800 space-y-2 leading-relaxed">
                        {block.clauses.map((c, i) => (
                          <li key={i} className="pl-3 border-l-[3px] border-indigo-300">
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 leading-relaxed">
                  좌측 목차(285 문자열 사전)에서 소목차를 선택하면 모범답안 웹문서가 생성됩니다.
                </p>
              )}
            </section>

            {activeDoc && (
              <section className="rounded-2xl border border-slate-200 p-4 bg-slate-50/80 mt-5">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-2">선택 문서</h4>
                <p className="text-sm font-semibold text-slate-900 leading-snug">{activeDoc.title}</p>
                <p className="text-xs text-indigo-700 font-mono mt-1">순위점수 {activeDoc.rankingScore}</p>
              </section>
            )}
          </>
        }
        adFrame={<EncyclopediaAdPanel embedded />}
        fitFrame={<EncyclopediaFitFrame meta={meta} searchResult={searchResult} keyword={keyword} />}
        rankStrip={
          documents.length > 1 ? (
            <EncyclopediaRankStrip
              documents={documents.slice(0, Math.min(documents.length, PAGE_SIZE))}
              selectedIndex={selectedDocIndex}
              onSelect={handleSelectDoc}
            />
          ) : undefined
        }
      />

      <FeatureDock
        project={project}
        projectId={projectId}
        draftContext={documents.slice(0, 4)}
        onArtifactSaved={() => {
          loadMeta();
          if (keyword.trim()) void handleSearch();
        }}
        ingestPanel={
          <div className="p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                value={ingestTitle}
                onChange={(e) => setIngestTitle(e.target.value)}
                placeholder="문서 제목"
                className="flex-1 min-w-[120px] px-2 py-1.5 text-xs border rounded-lg"
              />
              <select
                value={ingestDomain}
                onChange={(e) => setIngestDomain(e.target.value as LegalDomain)}
                className="px-2 py-1.5 text-xs border rounded-lg"
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <textarea
              value={ingestText}
              onChange={(e) => setIngestText(e.target.value)}
              placeholder="법률문서 텍스트 (제N조 자동 추출)"
              rows={8}
              className="w-full px-3 py-2 text-sm border rounded-xl font-mono leading-relaxed min-h-[180px]"
            />
            <Button size="sm" onClick={handleIngest} disabled={ingestLoading || !projectId} leftIcon={ingestLoading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}>
              {projectId ? (ingestLoading ? "벡터화 중…" : "ingest → 프로젝트 DB") : "프로젝트 선택 필요"}
            </Button>
            {meta?.dbReady && (
              <dl className="grid grid-cols-3 gap-2 text-[10px] pt-2 border-t border-slate-100">
                <div><dt className="text-slate-500">vectors</dt><dd className="font-bold">{meta.stats?.vectorCount ?? 0}</dd></div>
                <div><dt className="text-slate-500">docs</dt><dd className="font-bold">{meta.stats?.documentCount ?? 0}</dd></div>
                <div><dt className="text-slate-500">usage</dt><dd className="font-bold">{meta.stats?.usageCount ?? 0}</dd></div>
              </dl>
            )}
          </div>
        }
      />
    </div>
  );
}
