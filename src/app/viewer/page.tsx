"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, FileText, Layers, Type, X } from "lucide-react";
import { PdfCanvasViewer } from "@/components/pdf/PdfCanvasViewer";
import { VIEWER_STORAGE_KEY, isPdfMime, type ViewerPayload } from "@/lib/pdfPreview";
import { extractTextFromPdfBuffer } from "@/lib/pdfTextExtract";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type TabId = "original" | "text" | "structure";

export default function ViewerPage() {
  const [payload, setPayload] = useState<ViewerPayload | null>(null);
  const [tab, setTab] = useState<TabId>("original");
  const [textContent, setTextContent] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [structureHtml, setStructureHtml] = useState<string | null>(null);
  const [structureMessage, setStructureMessage] = useState<string | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(VIEWER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ViewerPayload;
        if (parsed.url) setPayload(parsed);
        localStorage.removeItem(VIEWER_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(VIEWER_STORAGE_KEY);
    }
  }, []);

  const loadText = useCallback(async () => {
    if (!payload?.url) return;
    setTextLoading(true);
    try {
      const res = await fetch(payload.url);
      const buf = await res.arrayBuffer();
      const text = await extractTextFromPdfBuffer(buf);
      setTextContent(text || "(추출된 텍스트가 없습니다.)");
    } catch {
      setTextContent("텍스트 추출에 실패했습니다.");
    } finally {
      setTextLoading(false);
    }
  }, [payload?.url]);

  const loadStructure = useCallback(async () => {
    if (!payload) return;
    setStructureLoading(true);
    setStructureHtml(null);
    setStructureMessage(null);
    try {
      let res: Response;
      if (payload.fileId && !payload.url.startsWith("blob:") && !payload.url.startsWith("data:")) {
        res = await fetch("/api/pdf/structured?format=html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ driveFileId: payload.fileId }),
        });
      } else {
        const fileRes = await fetch(payload.url);
        const blob = await fileRes.blob();
        const form = new FormData();
        form.append("file", blob, payload.fileName || "document.pdf");
        res = await fetch("/api/pdf/structured?format=html", {
          method: "POST",
          credentials: "include",
          body: form,
        });
      }
      const json = (await res.json()) as { html?: string; message?: string; source?: string };
      if (json.html) {
        setStructureHtml(json.html);
      } else {
        setStructureMessage(
          json.message ??
            "OpenDataLoader 구조 분석을 사용할 수 없습니다. 로컬 JVM 서버 설정이 필요합니다."
        );
      }
    } catch {
      setStructureMessage("구조 분석 요청에 실패했습니다.");
    } finally {
      setStructureLoading(false);
    }
  }, [payload]);

  useEffect(() => {
    if (tab === "text" && !textContent && !textLoading && payload && isPdfMime(payload.mimeType, payload.fileName)) {
      void loadText();
    }
  }, [tab, textContent, textLoading, payload, loadText]);

  useEffect(() => {
    if (tab === "structure" && structureHtml === null && structureMessage === null && !structureLoading && payload) {
      void loadStructure();
    }
  }, [tab, structureHtml, structureMessage, structureLoading, payload, loadStructure]);

  const close = () => window.close();

  if (!payload?.url) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-8 max-w-md text-center">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600">표시할 문서가 없습니다.</p>
          <p className="text-sm text-text-muted mt-2">자료실에서 「미리보기」를 눌러 여세요.</p>
          <button
            type="button"
            onClick={close}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
          >
            창 닫기
          </button>
        </div>
      </div>
    );
  }

  const isPdf = isPdfMime(payload.mimeType, payload.fileName);
  const isImage = payload.mimeType.startsWith("image/");

  const tabs: { id: TabId; label: string; icon: React.ReactNode; pdfOnly?: boolean }[] = [
    { id: "original", label: "원본", icon: <FileText size={14} /> },
    { id: "text", label: "텍스트", icon: <Type size={14} />, pdfOnly: true },
    { id: "structure", label: "구조 분석", icon: <Layers size={14} />, pdfOnly: true },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText size={18} className="text-primary-600 shrink-0" />
          <span className="text-sm font-medium text-slate-800 truncate">
            {payload.fileName || "문서 미리보기"}
          </span>
        </div>
        {isPdf && (
          <div className="flex items-center gap-1 shrink-0">
            {tabs
              .filter((t) => !t.pdfOnly || isPdf)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    tab === t.id
                      ? "bg-primary-100 text-primary-800"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
          </div>
        )}
        <button
          type="button"
          onClick={close}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
          title="닫기"
        >
          <X size={18} />
        </button>
      </header>

      <main className="flex-1 flex flex-col min-h-0 p-3">
        <div className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col min-h-0">
          {tab === "original" && (
            <>
              {isPdf ? (
                <PdfCanvasViewer url={payload.url} className="flex-1" />
              ) : isImage ? (
                <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                  <img src={payload.url} alt={payload.fileName} className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <iframe src={payload.url} title={payload.fileName} className="w-full flex-1 min-h-[480px] border-0" />
              )}
            </>
          )}

          {tab === "text" && isPdf && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs text-slate-600">pdf.js 텍스트 추출 (로컬)</span>
                {textContent && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                    onClick={() => {
                      void navigator.clipboard.writeText(textContent);
                      toast.success("클립보드에 복사했습니다.");
                    }}
                  >
                    <Copy size={12} /> 복사
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4 text-sm text-slate-800 whitespace-pre-wrap font-mono leading-relaxed">
                {textLoading ? "텍스트 추출 중…" : textContent}
              </div>
            </div>
          )}

          {tab === "structure" && isPdf && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-slate-100 text-xs text-slate-600">
                OpenDataLoader PDF — HTML/Markdown 구조 출력 (JVM 서버 연동 시)
              </div>
              {structureLoading ? (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                  구조 분석 중… (최초 실행 시 수십 초 걸릴 수 있습니다)
                </div>
              ) : structureHtml ? (
                <iframe
                  srcDoc={structureHtml}
                  title="구조 분석"
                  className="flex-1 w-full border-0 min-h-[400px]"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-sm text-slate-600 text-center max-w-lg mx-auto">
                  {structureMessage ??
                    "OpenDataLoader 서비스를 설정하면 표·제목·읽기 순서가 보존된 HTML 미리보기를 사용할 수 있습니다."}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
