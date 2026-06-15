"use client";

import { useState, useCallback, useMemo } from "react";
import { FileText, Upload, Loader2, ChevronDown, ChevronRight, Bot, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { buildJudgmentSummaryPrompt } from "@/lib/pdfSummaryPrompt";
import { parseStructuredSummary } from "@/lib/pdfSummaryParse";
import { DOCUMENT_ACCEPT } from "@/lib/documentOcr/types";

const ACCORDION_SECTIONS = [
  "사건의 개요",
  "주요 쟁점",
  "법원의 판단 (인용/기각 사유)",
  "결론 (주문)",
  "실무적 시사점",
];

const METHOD_LABEL: Record<string, string> = {
  "pdf-text": "PDF 텍스트",
  vision: "Google Vision OCR",
  clova: "CLOVA OCR",
  "gemini-vision": "Gemini OCR",
  pasted: "직접 입력",
};

interface PdfSummaryTabProps {
  boardId: string | null;
  postId: string | null;
  aiProvider?: "gemini" | "openai" | "auto";
  geminiConfigured?: boolean;
  openaiConfigured?: boolean;
  compact?: boolean;
  projectId?: string | null;
  onArtifactSaved?: () => void;
}

type DocumentFileState = {
  name: string;
  hash: string;
  mimeType: string;
  file: File;
};

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isAllowedDocument(f: File): boolean {
  const name = f.name.toLowerCase();
  if (f.type === "application/pdf" || name.endsWith(".pdf")) return true;
  if (f.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|tiff?|bmp|gif)$/i.test(name);
}

async function readDocumentFile(f: File): Promise<DocumentFileState> {
  const buffer = await f.arrayBuffer();
  const hash = await sha256Hex(buffer);
  return {
    name: f.name,
    hash,
    mimeType: f.type || "application/octet-stream",
    file: f,
  };
}

export function PdfSummaryTab({
  boardId,
  postId,
  aiProvider = "gemini",
  compact,
  projectId,
  onArtifactSaved,
}: PdfSummaryTabProps) {
  const [file, setFile] = useState<DocumentFileState | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [extractMethod, setExtractMethod] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(ACCORDION_SECTIONS));
  const [isDragging, setIsDragging] = useState(false);

  const parsedSections = useMemo(
    () => parseStructuredSummary(summary, ACCORDION_SECTIONS),
    [summary]
  );

  const toggleSection = useCallback((title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const loadDocumentFile = useCallback(async (f: File) => {
    if (!isAllowedDocument(f)) {
      toast.error("PDF 또는 이미지(JPG, PNG, WEBP, TIFF)만 업로드할 수 있습니다.");
      return;
    }
    setProgress(10);
    try {
      const loaded = await readDocumentFile(f);
      setProgress(100);
      setFile(loaded);
      setPastedText("");
      setExtractMethod(null);
      setSummary("");
      toast.success(`「${f.name}」을 불러왔습니다. 요약하기를 누르면 OCR로 텍스트를 추출합니다.`);
    } catch {
      toast.error("파일을 읽지 못했습니다.");
    } finally {
      window.setTimeout(() => setProgress(0), 400);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void loadDocumentFile(f);
    },
    [loadDocumentFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) void loadDocumentFile(f);
    },
    [loadDocumentFile]
  );

  const extractViaOcr = async (): Promise<string> => {
    if (!file?.file) {
      throw new Error("판결문 PDF·이미지를 업로드하거나 텍스트를 붙여넣어 주세요.");
    }

    setExtracting(true);
    try {
      const form = new FormData();
      form.append("file", file.file, file.name);

      const res = await fetch("/api/document/ocr", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "OCR 텍스트 추출에 실패했습니다.");
      }

      const text = ((data as { text?: string }).text ?? "").trim();
      const method = (data as { method?: string }).method ?? "unknown";
      const warnings = (data as { warnings?: string[] }).warnings;

      if (!text) {
        throw new Error("OCR 결과가 비어 있습니다. 다른 파일이나 텍스트 붙여넣기를 시도해 주세요.");
      }

      setPastedText(text);
      setExtractMethod(method);
      const label = METHOD_LABEL[method] ?? method;
      toast.success(`${label}로 ${text.length.toLocaleString()}자를 추출했습니다.`);
      if (warnings?.length) {
        warnings.forEach((w) => toast.info(w));
      }
      return text;
    } finally {
      setExtracting(false);
    }
  };

  const resolveSourceText = async (): Promise<string> => {
    const pasted = pastedText.trim();
    if (pasted && !file) {
      setExtractMethod("pasted");
      return pasted;
    }
    if (pasted && file && extractMethod) return pasted;
    if (file) return extractViaOcr();
    if (pasted) {
      setExtractMethod("pasted");
      return pasted;
    }
    throw new Error("판결문 PDF·이미지를 업로드하거나 텍스트를 붙여넣어 주세요.");
  };

  const handleSummarize = async () => {
    setLoading(true);
    setSummary("");
    try {
      const text = await resolveSourceText();
      const prompt = buildJudgmentSummaryPrompt(text);
      const body = { prompt, featureId: "doc_summary" as const };

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
            const textResult = (data as { text?: string }).text ?? "";
            if (!textResult.trim()) {
              throw new Error("AI가 빈 요약을 반환했습니다.");
            }
            setSummary(textResult);
            setExpandedSections(new Set(ACCORDION_SECTIONS));
            toast.success("Gemini 구조화 요약이 완료되었습니다.");
            return;
          }
          const msg = (data as { error?: string }).error ?? "요약 실패";
          const hint = (data as { hint?: string }).hint;
          lastErr = new Error(hint ? `${msg} (${hint})` : msg);
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error("요약 실패");
        }
      }
      throw lastErr ?? new Error("요약 실패");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "요약에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const addToTimeline = async () => {
    if (!summary.trim()) return;
    if (!boardId || !postId) {
      toast.error("사건 게시글에서 열면 타임라인에 기록할 수 있습니다.");
      return;
    }
    const content = `[🤖 AI 요약본]${file ? `\n원본: ${file.name} (SHA256: ${file.hash.slice(0, 16)}…)` : ""}\n\n${summary}`;
    try {
      const res = await fetch(`/api/board/${boardId}/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ co_content: content }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "등록 실패");
      toast.success("타임라인에 AI 요약본을 기록했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "타임라인 기록에 실패했습니다.");
    }
  };

  const saveToEncyclopedia = async () => {
    if (!projectId || !summary.trim()) return;
    try {
      const res = await fetch("/api/ai/legal-encyclopedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "sync_from_feature",
          projectId,
          featureId: "doc_summary",
          payload: {
            fileName: file?.name ?? "판결문",
            summary,
            ocrText: pastedText,
          },
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

  const busy = loading || extracting;

  return (
    <div className={cn("flex overflow-hidden", compact ? "h-auto flex-col p-3" : "h-full")}>
      <aside className="w-[360px] shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText size={16} className="text-primary-500" />
            판결문 입력
          </h2>
        </div>

        <div className="flex-1 p-4 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
              isDragging
                ? "border-primary-400 bg-primary-50"
                : "border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50"
            )}
          >
            <input
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="hidden"
              id="doc-upload"
              onChange={handleFileSelect}
            />
            <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload size={28} className={cn("shrink-0", isDragging ? "text-primary-500" : "text-slate-400")} />
              <span className="text-sm font-medium text-slate-600">
                판결문 PDF·이미지 파일을 이곳에 끌어다 놓으세요.
              </span>
              <span className="text-xs text-slate-500">PDF, JPG, PNG, WEBP, TIFF · 또는 클릭하여 선택</span>
            </label>
            {file && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-600 font-medium">파일: {file.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">SHA256: {file.hash.slice(0, 20)}…</p>
              </div>
            )}
            {progress > 0 && progress < 100 && (
              <div className="mt-3 w-full max-w-[200px] mx-auto h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {extractMethod && (
            <div className="flex items-center gap-2 text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
              <ScanLine size={14} />
              추출: {METHOD_LABEL[extractMethod] ?? extractMethod}
              {pastedText && ` · ${pastedText.length.toLocaleString()}자`}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              또는 판결문 텍스트 붙여넣기
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                if (!file) setExtractMethod("pasted");
              }}
              placeholder={
                file
                  ? "요약하기를 누르면 OCR로 텍스트를 추출합니다. 직접 붙여넣기·수정도 가능합니다."
                  : "PDF·이미지를 업로드하거나 판결문 텍스트를 붙여넣으세요."
              }
              rows={compact ? 16 : 10}
              className={cn(
                "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none bg-white leading-relaxed",
                compact && "min-h-[280px]"
              )}
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <Button
            className="w-full"
            leftIcon={busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            onClick={handleSummarize}
            disabled={busy || (!file && !pastedText.trim())}
          >
            {extracting ? "OCR 텍스트 추출 중…" : loading ? "Gemini 구조 분석·요약 중…" : "요약하기"}
          </Button>
          <p className="mt-2 text-xs text-slate-500 text-center leading-relaxed">
            PDF·스캔 이미지 → Vision/CLOVA/Gemini OCR → Gemini 구조화 요약
          </p>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText size={16} className="text-primary-500" />
            구조화된 요약
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {summary ? (
            <div className="space-y-2">
              {ACCORDION_SECTIONS.map((title) => {
                const content = parsedSections[title] ?? "";
                const isExpanded = expandedSections.has(title);
                return (
                  <div
                    key={title}
                    className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(title)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-primary-500 shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                      )}
                      {title}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 text-sm text-slate-700 whitespace-pre-wrap border-t border-slate-100 leading-relaxed">
                        {content || "(내용 없음)"}
                      </div>
                    )}
                  </div>
                );
              })}
              {boardId && postId && (
                <div className="pt-3">
                  <Button size="sm" variant="outline" leftIcon={<Bot size={14} />} onClick={addToTimeline}>
                    타임라인에 AI 요약본 기록
                  </Button>
                  {projectId && summary && (
                    <Button size="sm" variant="secondary" onClick={saveToEncyclopedia}>
                      백과·Drive 저장
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center text-slate-400 text-sm select-none">
              <FileText size={48} className="text-slate-200 mb-3" />
              <p className="font-medium text-slate-500">요약 결과가 여기에 표시됩니다</p>
              <p className="text-xs mt-1 text-slate-400 max-w-xs">
                왼쪽에서 PDF·이미지를 올리거나 텍스트를 붙여넣은 뒤 「요약하기」를 누르세요.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
