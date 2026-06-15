"use client";

import { useState, useRef, useCallback } from "react";
import {
  PenLine, Save, Download, AlertTriangle, Paperclip, X,
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  Search, ChevronDown, ChevronUp, FileText, Loader2, Type, Strikethrough,
  RotateCcw, Copy, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import * as Tooltip from "@radix-ui/react-tooltip";

const VERIFY_TOOLTIP = "⚠️ AI 생성 정보: 검토 필요 (Verify)";

const LEGAL_REF_PATTERN = /(민법\s*제\s*\d+\s*조|형법\s*제\s*\d+\s*조|상법\s*제\s*\d+\s*조|대법원\s*\d+다\d+|대법원\s*\d+가\d+|헌법\s*제\s*\d+\s*조|[가-힣]+\s*제\s*\d+\s*조)/g;

function highlightLegalRefs(text: string): React.ReactNode[] {
  const tokens: { type: "text" | "ref"; value: string }[] = [];
  let lastIndex = 0;
  const re = new RegExp(LEGAL_REF_PATTERN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) tokens.push({ type: "text", value: text.slice(lastIndex, m.index) });
    tokens.push({ type: "ref", value: m[0] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex) });
  if (tokens.length === 0) return [text];
  return tokens.map((t, i) =>
    t.type === "ref" ? (
      <Tooltip.Provider key={i} delayDuration={200}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <mark className="bg-amber-200/80 px-0.5 rounded cursor-help">{t.value}</mark>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="top" className="max-w-xs px-2 py-1.5 text-xs bg-slate-800 text-white rounded shadow-lg z-50">
              {VERIFY_TOOLTIP}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ) : (
      <span key={i}>{t.value}</span>
    )
  );
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  text: string;
  type: string;
}

interface BriefDraftTabProps {
  onSaveToDocs?: (title: string, content: string) => void;
  aiProvider?: "gemini" | "openai" | "auto";
  geminiConfigured?: boolean;
  openaiConfigured?: boolean;
  compact?: boolean;
  projectId?: string | null;
  onArtifactSaved?: () => void;
  initialContext?: string;
}

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px"];

/** textarea 커서 위치에 텍스트 삽입 */
function insertAtCursor(el: HTMLTextAreaElement, before: string, after = "", placeholder = "") {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = el.value.slice(start, end) || placeholder;
  const newValue = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
  const newPos = start + before.length + selected.length + after.length;
  el.focus();
  // React state가 제어하므로 nativeInputValueSetter를 통해 변경 이벤트 발생
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  nativeInputValueSetter?.call(el, newValue);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.setSelectionRange(newPos, newPos);
}

export function BriefDraftTab({
  onSaveToDocs,
  aiProvider = "gemini",
  compact,
  projectId,
  onArtifactSaved,
  initialContext,
}: BriefDraftTabProps) {
  const [stance, setStance] = useState<"원고" | "피고">("원고");
  const [facts, setFacts] = useState(initialContext ?? "");
  const [claims, setClaims] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  /* 에디터 상태 */
  const [editorText, setEditorText] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [fontSize, setFontSize] = useState("14px");
  const [wordWrap, setWordWrap] = useState(true);

  /* 찾기/바꾸기 */
  const [showSearch, setShowSearch] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  /* ─── 파일 처리 ─── */
  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve) => {
      if (!file.type.includes("text") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
        resolve(`[첨부 파일: ${file.name} — 텍스트를 직접 추출할 수 없습니다. AI 요청 시 파일명만 참고됩니다.]`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(typeof e.target?.result === "string" ? e.target.result : "");
      reader.onerror = () => resolve("");
      reader.readAsText(file, "utf-8");
    });

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: 10MB 이하 파일만 첨부할 수 있습니다.`);
        continue;
      }
      const text = await readFileAsText(file);
      setAttachedFiles((prev) => [
        ...prev,
        { id: `f${Date.now()}-${Math.random()}`, name: file.name, size: file.size, text, type: file.type },
      ]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (id: string) => setAttachedFiles((prev) => prev.filter((f) => f.id !== id));

  const formatSize = (bytes: number) =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

  /* ─── AI 초안 생성 ─── */
  const handleGenerate = async () => {
    if (!facts.trim()) { toast.error("사실관계 요약을 입력하세요."); return; }
    setLoading(true);
    try {
      const fileContext = attachedFiles.length
        ? `\n\n【첨부 파일 내용】\n${attachedFiles.map((f, i) => `[${i + 1}] ${f.name}\n${f.text.slice(0, 3000)}`).join("\n\n")}`
        : "";

      const prompt = `다음 정보를 바탕으로 ${stance} 입장의 준비서면 초안을 작성해주세요. 법조문이나 판례를 인용할 때는 정확한 표기(예: 민법 제750조, 대법원 2021다12345)를 사용하세요.

【사실관계 요약】
${facts}

【주요 주장(청구 취지)】
${claims.trim() || "(위 사실관계에 따른 법적 주장)"}${fileContext}`;

      const body = { prompt, featureId: "doc_draft" as const };
      const endpoints =
        aiProvider === "auto" ? ["/api/ai/gemini", "/api/ai/openai"] : aiProvider === "openai" ? ["/api/ai/openai"] : ["/api/ai/gemini"];
      let lastErr: Error | null = null;
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (res.ok) {
            const text = data.text ?? "";
            setEditorText(text);
            setPreviewMode(false);
            toast.success("초안이 생성되었습니다. 법조문·판례는 노란색으로 표시되며 반드시 검토하세요.");
            return;
          }
          lastErr = new Error(data.error ?? "작성 실패");
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error("작성 실패");
        }
      }
      throw lastErr ?? new Error("작성 실패");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "초안 작성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /* ─── 에디터 툴바 ─── */
  const toolbar = (fn: (el: HTMLTextAreaElement) => void) => {
    const el = editorRef.current;
    if (!el) return;
    fn(el);
  };

  const toolbarActions = {
    bold: () => toolbar((el) => insertAtCursor(el, "**", "**", "굵은 텍스트")),
    italic: () => toolbar((el) => insertAtCursor(el, "*", "*", "기울임 텍스트")),
    underline: () => toolbar((el) => insertAtCursor(el, "__", "__", "밑줄 텍스트")),
    strike: () => toolbar((el) => insertAtCursor(el, "~~", "~~", "취소선 텍스트")),
    h1: () => toolbar((el) => insertAtCursor(el, "\n# ", "", "제목 1")),
    h2: () => toolbar((el) => insertAtCursor(el, "\n## ", "", "제목 2")),
    ul: () => toolbar((el) => insertAtCursor(el, "\n- ", "", "항목")),
    ol: () => toolbar((el) => insertAtCursor(el, "\n1. ", "", "항목")),
    alignLeft: () => toolbar((el) => insertAtCursor(el, "", "", "")),
    legalSection: () => toolbar((el) => insertAtCursor(el, "\n\n【 】\n", "", "")),
    indent: () => toolbar((el) => insertAtCursor(el, "    ", "", "")),
    clear: () => { if (confirm("내용을 모두 지우시겠습니까?")) setEditorText(""); },
    copy: () => {
      navigator.clipboard.writeText(editorText).then(() => toast.success("복사했습니다."));
    },
  };

  /* ─── 찾기·바꾸기 ─── */
  const handleReplace = () => {
    if (!findText) return;
    setEditorText((prev) => prev.replaceAll(findText, replaceText));
    toast.success(`「${findText}」를 「${replaceText}」로 모두 바꿨습니다.`);
  };

  /* ─── 저장·내보내기 ─── */
  const handleSaveToDocs = () => {
    if (!editorText.trim()) { toast.error("저장할 내용이 없습니다."); return; }
    const title = `준비서면_${stance}_${new Date().toISOString().slice(0, 10)}`;
    onSaveToDocs?.(title, editorText);
    toast.success("문서함에 저장했습니다.");
  };

  const saveToEncyclopedia = async () => {
    if (!projectId || !editorText.trim()) return;
    const title = `준비서면_${stance}_${new Date().toISOString().slice(0, 10)}`;
    try {
      const res = await fetch("/api/ai/legal-encyclopedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "sync_from_feature",
          projectId,
          featureId: "doc_draft",
          payload: { title, content: editorText },
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

  const handleExport = (format: "txt" | "html") => {
    if (!editorText.trim()) { toast.error("내보낼 내용이 없습니다."); return; }
    const blob =
      format === "html"
        ? new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:serif;max-width:800px;margin:auto;padding:40px;line-height:2}pre{white-space:pre-wrap}</style></head><body><pre>${editorText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`], { type: "text/html" })
        : new Blob([editorText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `준비서면_${stance}_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(format === "html" ? "HTML로 내보냈습니다." : "TXT로 내보냈습니다.");
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>준비서면</title><style>body{font-family:"Malgun Gothic",serif;max-width:800px;margin:auto;padding:40px;line-height:2;font-size:14px}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><pre>${editorText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`);
    win.document.close();
    win.print();
  };

  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;
  const charCount = editorText.length;
  const hasLegalRefs = new RegExp(LEGAL_REF_PATTERN.source).test(editorText);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ══════════════ 좌 프레임 ══════════════ */}
      <aside className="w-[340px] shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <PenLine size={15} className="text-primary-500" />
            준비서면 입력
          </h2>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* 스탠스 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">스탠스</label>
            <div className="flex gap-2">
              {(["원고", "피고"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStance(s)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-semibold transition-colors",
                    stance === s ? "bg-primary-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 사실관계 요약 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">사실관계 요약 *</label>
            <textarea
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              placeholder="분쟁의 경위, 계약·사고 내용, 날짜·장소 등 핵심 사실을 입력하세요."
              rows={compact ? 12 : 6}
              className={cn(
                "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none bg-white leading-relaxed",
                compact && "min-h-[240px]"
              )}
            />
          </div>

          {/* 청구취지 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">청구취지 / 주요 주장</label>
            <textarea
              value={claims}
              onChange={(e) => setClaims(e.target.value)}
              placeholder="피고는 원고에게 OOO을 지급하라 등 청구취지를 입력하세요."
              rows={compact ? 8 : 4}
              className={cn(
                "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none bg-white leading-relaxed",
                compact && "min-h-[160px]"
              )}
            />
          </div>

          {/* 첨부파일 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">첨부파일 (AI 전달)</label>
              <span className="text-xs text-slate-400">TXT·PDF·MD / 10MB 이하</span>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-xs",
                isDragging ? "border-primary-400 bg-primary-50" : "border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50"
              )}
            >
              <Paperclip size={20} className={isDragging ? "text-primary-500" : "text-slate-400"} />
              <span className="text-slate-500">클릭 또는 파일을 끌어다 놓으세요</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.pdf,.docx"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {attachedFiles.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {attachedFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                    <FileText size={13} className="text-primary-400 shrink-0" />
                    <span className="flex-1 text-xs text-slate-700 truncate" title={f.name}>{f.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="text-slate-400 hover:text-red-500 shrink-0"
                      aria-label="삭제"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 생성 버튼 */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            leftIcon={loading ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />}
            className="w-full"
          >
            {loading ? "AI 작성 중…" : "초안 생성"}
          </Button>
          {attachedFiles.length > 0 && (
            <p className="mt-1.5 text-xs text-primary-600 text-center">
              📎 첨부 파일 {attachedFiles.length}개가 AI에 함께 전달됩니다.
            </p>
          )}
        </div>
      </aside>

      {/* ══════════════ 우 프레임 — 에디터 ══════════════ */}
      <main className="flex-1 min-w-0 flex flex-col bg-white overflow-hidden">
        {/* 에디터 상단 툴바 */}
        <div className="border-b border-slate-200 bg-white px-3 py-1.5 flex items-center gap-1 flex-wrap">
          {/* 텍스트 서식 */}
          <ToolBtn icon={Bold} label="굵게" onClick={toolbarActions.bold} />
          <ToolBtn icon={Italic} label="기울임" onClick={toolbarActions.italic} />
          <ToolBtn icon={Underline} label="밑줄" onClick={toolbarActions.underline} />
          <ToolBtn icon={Strikethrough} label="취소선" onClick={toolbarActions.strike} />

          <Divider />
          <ToolBtn icon={Heading1} label="제목 1" onClick={toolbarActions.h1} />
          <ToolBtn icon={Heading2} label="제목 2" onClick={toolbarActions.h2} />

          <Divider />
          <ToolBtn icon={List} label="글머리 목록" onClick={toolbarActions.ul} />
          <ToolBtn icon={ListOrdered} label="번호 목록" onClick={toolbarActions.ol} />

          <Divider />
          <button
            type="button"
            onClick={toolbarActions.legalSection}
            className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded"
            title="법률 섹션 삽입"
          >
            【 】
          </button>

          <Divider />
          {/* 글꼴 크기 */}
          <div className="flex items-center gap-1">
            <Type size={13} className="text-slate-400" />
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <Divider />
          <ToolBtn icon={Search} label="찾기·바꾸기" onClick={() => setShowSearch((v) => !v)} active={showSearch} />
          <ToolBtn icon={Copy} label="복사" onClick={toolbarActions.copy} />
          <ToolBtn icon={RotateCcw} label="내용 지우기" onClick={toolbarActions.clear} />

          <Divider />
          {/* 미리보기 */}
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors",
              previewMode ? "bg-primary-100 text-primary-700" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {previewMode ? "편집 모드" : "미리보기"}
          </button>

          {/* 저장·내보내기 */}
          <div className="ml-auto flex items-center gap-1">
            <Button size="xs" variant="outline" leftIcon={<Save size={12} />} onClick={handleSaveToDocs}>
              문서함
            </Button>
            {projectId && (
              <Button size="xs" variant="secondary" onClick={saveToEncyclopedia}>
                백과 저장
              </Button>
            )}
            <Button size="xs" variant="outline" leftIcon={<Download size={12} />} onClick={() => handleExport("txt")}>
              TXT
            </Button>
            <Button size="xs" variant="outline" leftIcon={<Download size={12} />} onClick={() => handleExport("html")}>
              HTML
            </Button>
            <Button size="xs" variant="outline" leftIcon={<Printer size={12} />} onClick={handlePrint}>
              인쇄
            </Button>
          </div>
        </div>

        {/* 찾기·바꾸기 패널 */}
        {showSearch && (
          <div className="border-b border-slate-200 bg-amber-50 px-4 py-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">찾기</span>
            <input
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="찾을 텍스트"
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white w-40"
            />
            <span className="text-xs font-medium text-slate-600">바꾸기</span>
            <input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="바꿀 텍스트"
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white w-40"
            />
            <Button size="xs" onClick={handleReplace}>모두 바꾸기</Button>
            <button type="button" onClick={() => setShowSearch(false)} className="ml-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
        )}

        {/* 법조문 경고 */}
        {hasLegalRefs && !previewMode && (
          <div className="px-4 py-2 flex items-center gap-2 text-amber-700 text-xs bg-amber-50 border-b border-amber-100">
            <AlertTriangle size={13} />
            <span>노란색 표시는 법조문·판례 인용입니다. 생성된 인용은 반드시 검토하세요.</span>
          </div>
        )}

        {/* 에디터 / 미리보기 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {editorText === "" && !previewMode ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-sm select-none">
              <PenLine size={48} className="text-slate-200 mb-3" />
              <p className="font-medium text-slate-500">초안이 여기에 표시됩니다</p>
              <p className="text-xs mt-1 text-slate-400">왼쪽 입력창에서 사실관계를 입력하고 「초안 생성」을 누르세요.</p>
            </div>
          ) : previewMode ? (
            <div
              className="h-full overflow-y-auto p-8 text-slate-800 leading-loose whitespace-pre-wrap"
              style={{ fontSize }}
            >
              {highlightLegalRefs(editorText)}
            </div>
          ) : (
            <textarea
              ref={editorRef}
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              className="w-full h-full p-6 text-slate-800 leading-loose resize-none focus:outline-none bg-white"
              style={{ fontSize, wordBreak: wordWrap ? "break-word" : "normal", whiteSpace: wordWrap ? "pre-wrap" : "pre" }}
              placeholder="초안이 생성되면 여기서 직접 편집할 수 있습니다."
              spellCheck={false}
            />
          )}
        </div>

        {/* 하단 상태바 */}
        <div className="border-t border-slate-100 px-4 py-1.5 flex items-center gap-4 text-xs text-slate-400 bg-slate-50">
          <span>{charCount.toLocaleString()}자</span>
          <span>{wordCount.toLocaleString()}단어</span>
          <span>{editorText.split("\n").length}줄</span>
          <button
            type="button"
            onClick={() => setWordWrap((v) => !v)}
            className="ml-auto hover:text-slate-600"
          >
            {wordWrap ? "줄바꿈 ON" : "줄바꿈 OFF"}
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-medium">
            {aiProvider === "openai" ? "ChatGPT" : "Gemini"}
          </span>
        </div>
      </main>
    </div>
  );
}

/* ─── 공통 툴바 버튼 ─── */
function ToolBtn({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "p-1.5 rounded transition-colors",
              active ? "bg-primary-100 text-primary-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
          >
            <Icon size={14} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="bottom" className="px-2 py-1 text-xs bg-slate-800 text-white rounded shadow-lg z-50">
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />;
}
