"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  FileText,
  Save,
  Pencil,
  Trash2,
  Sparkles,
  FolderOpen,
  Plus,
} from "lucide-react";
import { AI_FEATURES } from "@/lib/boardConfig";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { CaseRecommendTab } from "@/components/board/ai/CaseRecommendTab";
import { PdfSummaryTab } from "@/components/board/ai/PdfSummaryTab";
import { BriefDraftTab } from "@/components/board/ai/BriefDraftTab";
import { LawSearchTab } from "@/components/board/ai/LawSearchTab";
import { LegalEncyclopediaWorkspace } from "@/components/board/ai/LegalEncyclopediaWorkspace";

const STORAGE_KEY = "lawygo_ai_docs";
const CATEGORIES = ["저장 문서", "참고자료", "초안"];

interface SavedDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

function loadDocs(featureId: string): SavedDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, SavedDoc[]>) : {};
    return map[featureId] ?? [];
  } catch {
    return [];
  }
}

function saveDocs(featureId: string, list: SavedDoc[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, SavedDoc[]>) : {};
    map[featureId] = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("saveDocs failed", e);
  }
}

export default function BoardAiFeaturePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const featureId = (params?.featureId as string) ?? "";
  const feature = AI_FEATURES.find((f) => f.id === featureId);

  const boardId = searchParams.get("boardId");
  const postId = searchParams.get("postId");
  const encyclopediaProjectId = searchParams.get("projectId");
  const encyclopediaKeyword = searchParams.get("keyword");
  const encyclopediaContext = searchParams.get("context");
  const [postContent, setPostContent] = useState("");

  const [prompt, setPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<SavedDoc[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  type AiProviderType = "gemini" | "openai" | "auto";
  const [aiProvider, setAiProvider] = useState<AiProviderType>("auto");
  const [geminiOk, setGeminiOk] = useState(false);
  const [openaiOk, setOpenaiOk] = useState(false);

  useEffect(() => {
    if (!boardId || !postId || Number.isNaN(Number(postId))) return;
    fetch(`/api/board/${boardId}/${postId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data?.data?.content) setPostContent(data.data.content);
      })
      .catch(() => {});
  }, [boardId, postId]);

  useEffect(() => {
    Promise.all([fetch("/api/ai/gemini").then((r) => r.json()), fetch("/api/ai/openai").then((r) => r.json())])
      .then(([g, o]) => {
        const gOk = !!(g as { configured?: boolean }).configured;
        const oOk = !!(o as { configured?: boolean }).configured;
        setGeminiOk(gOk);
        setOpenaiOk(oOk);
        setAiProvider((prev) => {
          if (prev === "openai" && !oOk && gOk) return "gemini";
          if (prev === "gemini" && !gOk && oOk) return "openai";
          return prev;
        });
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => setDocs(loadDocs(featureId)), [featureId]);
  useEffect(() => load(), [load]);

  const handleAsk = async () => {
    if (!prompt.trim()) {
      toast.error("질의 내용을 입력하세요.");
      return;
    }
    setLoading(true);
    setAiResult("");
    const body = { prompt: prompt.trim(), featureId };
    try {
      let lastError: Error | null = null;
      const toTry: string[] =
        aiProvider === "auto"
          ? ["/api/ai/gemini", "/api/ai/openai"]
          : aiProvider === "openai"
            ? ["/api/ai/openai"]
            : ["/api/ai/gemini"];
      for (const endpoint of toTry) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (res.ok) {
            setAiResult(data.text ?? "");
            toast.success("답변을 생성했습니다.");
            return;
          }
          lastError = new Error(data.error ?? "요청 실패");
        } catch (e) {
          lastError = e instanceof Error ? e : new Error("요청 실패");
        }
      }
      throw lastError ?? new Error("AI 요청에 실패했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const addDoc = (title?: string, content?: string) => {
    const newDoc: SavedDoc = {
      id: `doc-${Date.now()}`,
      title: title ?? "제목 없음",
      content: content ?? aiResult ?? "",
      category,
      updatedAt: new Date().toISOString(),
    };
    const next = [...docs, newDoc];
    setDocs(next);
    saveDocs(featureId, next);
    setEditingId(newDoc.id);
    setEditTitle(newDoc.title);
    setEditContent(newDoc.content);
    if (!title && !content) toast.success("문서를 추가했습니다.");
  };

  const updateDoc = () => {
    if (!editingId) return;
    const next = docs.map((d) =>
      d.id === editingId
        ? { ...d, title: editTitle, content: editContent, updatedAt: new Date().toISOString() }
        : d
    );
    setDocs(next);
    saveDocs(featureId, next);
    setEditingId(null);
    toast.success("수정했습니다.");
  };

  const deleteDoc = (id: string) => {
    if (!confirm("이 문서를 삭제하시겠습니까?")) return;
    const next = docs.filter((d) => d.id !== id);
    setDocs(next);
    saveDocs(featureId, next);
    if (editingId === id) setEditingId(null);
    toast.success("삭제했습니다.");
  };

  const startEdit = (doc: SavedDoc) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditContent(doc.content);
  };

  const filteredDocs = docs.filter((d) => d.category === category);
  const editingDoc = editingId ? docs.find((d) => d.id === editingId) : null;

  const isLegalEncyclopedia = featureId === "legal_encyclopedia";
  const isCaseRecommend = featureId === "case_search";
  const isPdfSummary = featureId === "doc_summary";
  const isBriefDraft = featureId === "doc_draft";
  const isLawSearch = featureId === "law_search";
  const isGenericAi = !isLegalEncyclopedia && !isCaseRecommend && !isPdfSummary && !isBriefDraft && !isLawSearch;

  if (!feature) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-slate-600">알 수 없는 기능입니다.</p>
        <Link href="/board" className="text-primary-600 hover:underline mt-2 inline-block">
          게시판으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full h-full overflow-hidden">
      {isLegalEncyclopedia ? (
        <div className="flex-1 flex min-h-0 min-w-0 w-full">
          <LegalEncyclopediaWorkspace />
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-4 flex-wrap">
            <Link
              href={boardId && postId ? `/board/${boardId}/post/${postId}` : "/board"}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600"
            >
              <ArrowLeft size={16} />
              {boardId && postId ? "해당 글" : "게시판"}
            </Link>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={20} className="text-primary-500" />
              {feature.name}
            </h1>
            <span className="text-xs text-text-muted">{feature.description}</span>
            {(isCaseRecommend || isPdfSummary || isBriefDraft || isLawSearch) && (
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as AiProviderType)}
                className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
                title="AI 엔진 선택"
              >
                <option value="auto" disabled={!geminiOk && !openaiOk}>AUTO (실패 시 자동 전환)</option>
                <option value="gemini" disabled={!geminiOk}>{geminiOk ? "Gemini" : "Gemini (미설정)"}</option>
                <option value="openai" disabled={!openaiOk}>{openaiOk ? "ChatGPT" : "ChatGPT (미설정)"}</option>
              </select>
            )}
            {boardId && postId && (
              <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">사건 타임라인 연동 가능</span>
            )}
          </div>

      {isCaseRecommend && (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 flex flex-col border-r border-slate-200">
            <CaseRecommendTab
              initialCaseSummary={postContent}
              boardId={boardId}
              postId={postId}
              aiProvider={aiProvider}
              geminiConfigured={geminiOk}
              openaiConfigured={openaiOk}
            />
          </div>
        </div>
      )}

      {isPdfSummary && (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            <PdfSummaryTab
              boardId={boardId}
              postId={postId}
              aiProvider={aiProvider}
              geminiConfigured={geminiOk}
              openaiConfigured={openaiOk}
            />
          </div>
        </div>
      )}

      {isBriefDraft && (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            <BriefDraftTab
              onSaveToDocs={addDoc}
              aiProvider={aiProvider}
              geminiConfigured={geminiOk}
              openaiConfigured={openaiOk}
              projectId={encyclopediaProjectId}
              initialContext={
                encyclopediaContext ??
                (encyclopediaKeyword ? `검색 키워드: ${encyclopediaKeyword}` : undefined)
              }
            />
          </div>
        </div>
      )}

      {isLawSearch && (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            <LawSearchTab
              aiProvider={aiProvider}
              geminiConfigured={geminiOk}
              openaiConfigured={openaiOk}
            />
          </div>
        </div>
      )}

      {isGenericAi && (
        <div className="flex-1 flex min-h-0">
          <aside className="w-1/2 min-w-0 border-r border-slate-200 flex flex-col bg-slate-50/50">
            <div className="px-4 py-3 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-medium text-slate-600">질의</label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as AiProviderType)}
                  className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white"
                >
                  <option value="auto" disabled={!geminiOk && !openaiOk}>AUTO (실패 시 자동 전환)</option>
                  <option value="gemini" disabled={!geminiOk}>{geminiOk ? "Gemini" : "Gemini (미설정)"}</option>
                  <option value="openai" disabled={!openaiOk}>{openaiOk ? "ChatGPT" : "ChatGPT (미설정)"}</option>
                </select>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="검색어, 질문, 요약할 문서 내용 등을 입력하세요..."
                  rows={2}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
                <Button
                  type="button"
                  leftIcon={<Send size={14} />}
                  onClick={handleAsk}
                  disabled={loading}
                  className="shrink-0"
                >
                  {loading ? "처리 중…" : "질의"}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {aiResult ? (
                <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                  {aiResult}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-text-muted text-sm">
                  <Sparkles size={40} className="text-slate-300 mb-2" />
                  <p>질의를 입력하고 「질의」를 누르면 AI 결과가 여기에 표시됩니다.</p>
                </div>
              )}
            </div>
          </aside>
          <main className="w-1/2 min-w-0 flex flex-col bg-white">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    category === cat ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {cat}
                </button>
              ))}
              <Button size="xs" variant="outline" leftIcon={<Plus size={12} />} onClick={() => addDoc()} className="ml-auto">
                문서 추가
              </Button>
            </div>
            <div className="flex-1 flex min-h-0">
              <div className="w-48 border-r border-slate-100 flex flex-col overflow-hidden">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase">목록 ({filteredDocs.length})</div>
                <div className="flex-1 overflow-y-auto">
                  {filteredDocs.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-text-muted">문서가 없습니다.</p>
                  ) : (
                    filteredDocs.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => startEdit(doc)}
                        className={cn(
                          "w-full text-left px-2 py-2 rounded-r text-xs truncate",
                          editingId === doc.id ? "bg-primary-50 text-primary-700 font-medium" : "hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <FileText size={12} className="inline mr-1 align-middle" />
                        {doc.title}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col min-w-0 p-4">
                {editingDoc ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg"
                        placeholder="제목"
                      />
                      <Button size="sm" leftIcon={<Save size={14} />} onClick={updateDoc}>
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger-600"
                        leftIcon={<Trash2 size={14} />}
                        onClick={() => deleteDoc(editingDoc.id)}
                      >
                        삭제
                      </Button>
                    </div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="내용"
                      className="flex-1 min-h-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500/20 outline-none"
                    />
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-text-muted text-sm">
                    <FolderOpen size={40} className="text-slate-300 mb-2" />
                    <p>목록에서 문서를 선택하거나 「문서 추가」로 새 문서를 등록하세요.</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}
        </>
      )}
    </div>
  );
}
