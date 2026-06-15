// filepath: src/components/board/ai/encyclopedia/FeatureDock.tsx
"use client";

import { useState } from "react";
import { Scale, FileStack, Search, Bot, PenLine, BookOpen, FolderOpen, PanelBottomOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CaseRecommendTab } from "@/components/board/ai/CaseRecommendTab";
import { PdfSummaryTab } from "@/components/board/ai/PdfSummaryTab";
import { BriefDraftTab } from "@/components/board/ai/BriefDraftTab";
import { LawSearchTab } from "@/components/board/ai/LawSearchTab";
import type { RankedLegalDocument } from "@/lib/legalEncyclopedia/types";
import type { EncyclopediaProjectOption } from "./ProjectSelector";
import { CompanyDriveExplorer } from "./CompanyDriveExplorer";

const TABS = [
  { id: "case_search", label: "판례추천", icon: Scale },
  { id: "doc_summary", label: "PDF요약", icon: FileStack },
  { id: "law_search", label: "법령검색", icon: Search },
  { id: "ai_search", label: "AI검색", icon: Bot },
  { id: "doc_draft", label: "서면작성", icon: PenLine },
  { id: "resource_room", label: "자료실", icon: FolderOpen },
] as const;

type TabId = (typeof TABS)[number]["id"] | "ingest";

interface FeatureDockProps {
  project: EncyclopediaProjectOption | null;
  projectId: string | null;
  draftContext?: RankedLegalDocument[];
  onArtifactSaved?: () => void;
  ingestPanel?: React.ReactNode;
}

function AiSearchEmbed({
  projectId,
  onSaved,
}: {
  projectId: string | null;
  onSaved?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: prompt.trim(), featureId: "ai_search" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.text ?? "");
    } catch (e) {
      setResult(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!projectId || !result) return;
    await fetch("/api/ai/legal-encyclopedia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "sync_from_feature",
        projectId,
        featureId: "ai_search",
        payload: { query: prompt, answer: result },
      }),
    });
    onSaved?.();
  };

  return (
    <div className="p-3 space-y-2">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="자연어 법률 질의"
        rows={5}
        className="w-full text-sm border rounded-lg px-3 py-2 resize-none leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && handleAsk()}
      />
      <div className="flex gap-2">
        <button type="button" onClick={handleAsk} disabled={loading} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg">
          {loading ? "…" : "검색"}
        </button>
        <span className="text-[10px] text-slate-400 self-center">Ctrl+Enter로 검색</span>
      </div>
      {result && (
        <>
          <pre className="text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto bg-white border rounded-lg p-2">{result}</pre>
          {projectId && (
            <button type="button" onClick={save} className="text-xs text-indigo-700 font-medium">
              백과에 저장
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function FeatureDock({ project, projectId, draftContext, onArtifactSaved, ingestPanel }: FeatureDockProps) {
  const [active, setActive] = useState<TabId>("case_search");
  const [expanded, setExpanded] = useState(false);

  const caseSummary = project
    ? `${project.client_name} ${project.case_title} 관련 분쟁`
    : "";

  return (
    <footer className="shrink-0 border-t border-slate-200 bg-white">
      <div className="px-3 md:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-700">
            <BookOpen size={14} className="text-indigo-600 shrink-0" />
            <span>기능 Dock — AI 문서엔진 연동</span>
            {!projectId && (
              <span className="text-amber-600 font-normal text-[11px]">(프로젝트 선택 필요)</span>
            )}
          </div>
          <p className="text-[10px] md:text-[11px] text-slate-500 leading-snug pl-5 md:pl-0">
            오른쪽 <span className="font-semibold text-indigo-700">「사용」</span> 버튼을 누르면
            판례·법령·서면 등 AI 도구 패널이 아래로 펼쳐집니다. 다시 누르면 접힙니다.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant={expanded ? "outline" : "primary"}
          leftIcon={<PanelBottomOpen size={14} />}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="feature-dock-panel"
          className={cn(
            "shrink-0 min-w-[72px] font-bold shadow-sm",
            !expanded && "ring-2 ring-indigo-200 ring-offset-1"
          )}
        >
          {expanded ? "접기" : "사용"}
        </Button>
      </div>

      {expanded && (
        <div id="feature-dock-panel">
          <div className="flex gap-1 px-3 pt-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border",
                  active === t.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200"
                )}
              >
                <t.icon size={12} /> {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActive("ingest")}
              className={cn(
                "shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border",
                active === "ingest" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              ingest
            </button>
          </div>

          <div className="min-h-[360px] max-h-[560px] overflow-y-auto border-t border-slate-100 mt-2">
            {active === "case_search" && (
              <CaseRecommendTab
                initialCaseSummary={caseSummary}
                boardId={null}
                postId={null}
                compact
                projectId={projectId}
                onArtifactSaved={onArtifactSaved}
              />
            )}
            {active === "doc_summary" && (
              <PdfSummaryTab
                boardId={null}
                postId={null}
                compact
                projectId={projectId}
                onArtifactSaved={onArtifactSaved}
              />
            )}
            {active === "law_search" && (
              <LawSearchTab compact projectId={projectId} onArtifactSaved={onArtifactSaved} />
            )}
            {active === "ai_search" && <AiSearchEmbed projectId={projectId} onSaved={onArtifactSaved} />}
            {active === "doc_draft" && (
              <BriefDraftTab
                compact
                projectId={projectId}
                onArtifactSaved={onArtifactSaved}
                initialContext={draftContext?.map((d) => `${d.title}\n${d.body.slice(0, 800)}`).join("\n\n---\n\n")}
              />
            )}
            {active === "resource_room" && <CompanyDriveExplorer />}
            {active === "ingest" && ingestPanel}
          </div>
        </div>
      )}
    </footer>
  );
}
