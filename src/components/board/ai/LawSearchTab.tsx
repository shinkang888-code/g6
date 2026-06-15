"use client";

import { useState, useCallback, useMemo } from "react";
import { BookOpen, Send, Loader2, ChevronRight, ExternalLink, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { buildLawGoKrArticleUrl } from "@/lib/lawLinks";
import {
  extractLawSearchIntro,
  parseLawArticlesFromAiText,
  type LawArticleItem,
} from "@/lib/lawSearchParse";
import { LawArticleViewer } from "@/components/board/ai/LawArticleViewer";

interface LawSearchTabProps {
  aiProvider?: "gemini" | "openai" | "auto";
  geminiConfigured?: boolean;
  openaiConfigured?: boolean;
  compact?: boolean;
  projectId?: string | null;
  onArtifactSaved?: () => void;
}

export function LawSearchTab({ aiProvider = "gemini", compact, projectId, onArtifactSaved }: LawSearchTabProps) {
  const [prompt, setPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<LawArticleItem | null>(null);

  const intro = useMemo(() => extractLawSearchIntro(aiResult), [aiResult]);
  const articles = useMemo(() => parseLawArticlesFromAiText(aiResult), [aiResult]);

  const externalUrl = selectedArticle
    ? buildLawGoKrArticleUrl(
        selectedArticle.lawName,
        selectedArticle.articleNo,
        selectedArticle.articleSub
      )
    : "";

  const handleAsk = async () => {
    if (!prompt.trim()) {
      toast.error("질의 내용을 입력하세요.");
      return;
    }
    setLoading(true);
    setAiResult("");
    setSelectedArticle(null);

    const fullPrompt = `다음 법률 검색 질의에 맞는 관련 조문을 찾아주세요.

각 조문마다 반드시 ---ARTICLE--- 구분자를 사용하고 아래 형식으로 작성하세요.

---ARTICLE---
법령명: (예: 의료법)
조문: (예: 제2조 또는 제17조의2)
제목: (조문 제목)
요약: (해당 조문의 핵심 내용 1~2문장)

질의 시작 전에 1~2문장으로 전체 답변 요약을 먼저 작성하세요.

질의:
${prompt.trim()}`;

    try {
      const body = { prompt: fullPrompt, featureId: "law_search" as const };
      const endpoints =
        aiProvider === "auto"
          ? ["/api/ai/gemini", "/api/ai/openai"]
          : aiProvider === "openai"
            ? ["/api/ai/openai"]
            : ["/api/ai/gemini"];

      let lastErr: Error | null = null;
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: "include",
          });
          const data = await res.json();
          if (res.ok) {
            const text = (data as { text?: string }).text ?? "";
            setAiResult(text);
            const parsed = parseLawArticlesFromAiText(text);
            if (parsed.length > 0) {
              setSelectedArticle(parsed[0]);
            }
            toast.success(
              parsed.length
                ? `${parsed.length}개 조문을 찾았습니다. 조문을 클릭하면 우측에서 원문을 확인할 수 있습니다.`
                : "답변을 생성했습니다."
            );
            return;
          }
          const msg = (data as { error?: string }).error ?? "요청 실패";
          const hint = (data as { hint?: string }).hint;
          lastErr = new Error(hint ? `${msg} (${hint})` : msg);
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error("요청 실패");
        }
      }
      throw lastErr ?? new Error("법률 검색에 실패했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "법률 검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const saveToEncyclopedia = async () => {
    if (!projectId || articles.length === 0) return;
    try {
      const res = await fetch("/api/ai/legal-encyclopedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "sync_from_feature",
          projectId,
          featureId: "law_search",
          payload: { articles, query: prompt },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? "백과에 저장됨");
      onArtifactSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "백과 저장 실패");
    }
  };

  const selectArticle = useCallback((article: LawArticleItem) => {
    setSelectedArticle(article);
  }, []);

  return (
    <div className={cn("flex overflow-hidden", compact ? "h-auto" : "h-full")}>
      <aside className="w-[420px] shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={16} className="text-primary-500" />
            법률 검색 · 조문 목록
          </h2>
        </div>

        <div className="shrink-0 p-4 border-b border-slate-200 bg-white space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예: 의료법 중에 한의사 관련 조항 찾아"
            rows={compact ? 5 : 2}
            className={cn(
              "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none leading-relaxed",
              compact && "min-h-[120px]"
            )}
          />
          <Button
            className="w-full"
            leftIcon={loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            onClick={handleAsk}
            disabled={loading}
          >
            {loading ? "검색 중…" : "질의"}
          </Button>
          {projectId && articles.length > 0 && (
            <Button variant="outline" size="sm" className="w-full" onClick={saveToEncyclopedia}>
              백과·Drive 저장 ({articles.length}조문)
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {intro && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {intro}
            </div>
          )}

          {articles.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-2">
                관련 조문 ({articles.length}건) — 클릭 시 우측에서 원문 확인
              </h3>
              <ul className="space-y-1.5">
                {articles.map((article) => {
                  const isActive = selectedArticle?.id === article.id;
                  return (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => selectArticle(article)}
                        className={cn(
                          "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                          isActive
                            ? "border-primary-400 bg-primary-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary-700 truncate flex-1">
                            {article.lawName} 제{article.articleNo}조
                            {article.articleSub ? `의${article.articleSub}` : ""}
                          </span>
                          <ChevronRight
                            size={14}
                            className={cn("shrink-0", isActive ? "text-primary-600" : "text-slate-400")}
                          />
                        </div>
                        {article.title && (
                          <p className="text-xs font-medium text-slate-700 mt-0.5">{article.title}</p>
                        )}
                        {article.summary && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{article.summary}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : aiResult && !loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {aiResult}
            </div>
          ) : !loading ? (
            <p className="text-xs text-slate-500 text-center py-8">
              질의를 입력하고 「질의」를 누르면 관련 조문이 여기에 표시됩니다.
            </p>
          ) : null}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0">
            <Scale size={16} className="text-primary-500 shrink-0" />
            <span className="truncate">
              {selectedArticle
                ? `${selectedArticle.lawName} 제${selectedArticle.articleNo}조${selectedArticle.articleSub ? `의${selectedArticle.articleSub}` : ""}`
                : "법령 원문 미리보기"}
            </span>
          </h2>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 shrink-0"
            >
              <ExternalLink size={12} />
              새 창에서 보기
            </a>
          )}
        </div>

        <div className="flex-1 min-h-0 bg-slate-100 p-3 flex flex-col">
          {selectedArticle ? (
            <LawArticleViewer article={selectedArticle} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-sm select-none rounded-xl border border-dashed border-slate-200 bg-white">
              <BookOpen size={48} className="text-slate-200 mb-3" />
              <p className="font-medium text-slate-500">조문을 선택하면 원문이 표시됩니다</p>
              <p className="text-xs mt-1 text-slate-400 max-w-sm">
                왼쪽 조문 목록을 클릭하면 Open API 원문, 검색 페이지 임베드, AI 요약 순으로 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
