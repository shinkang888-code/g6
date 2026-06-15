"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfDoc = PDFDocumentProxy;

async function loadPdfDocument(url: string): Promise<PdfDoc> {
  const pdfjs = await import("pdfjs-dist");
  const { getDocument, GlobalWorkerOptions, version } = pdfjs;
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("PDF를 불러올 수 없습니다.");
  const buffer = await res.arrayBuffer();
  return getDocument({ data: buffer.slice(0) }).promise;
}

type Props = {
  url: string;
  className?: string;
};

export function PdfCanvasViewer({ url, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdf(null);
    setPageNum(1);

    loadPdfDocument(url)
      .then((doc) => {
        if (!cancelled) setPdf(doc);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "PDF 로드 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  }, [pdf, pageNum, scale]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-slate-500 p-6", className)}>
        PDF 불러오는 중…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-danger-600 p-6 text-center", className)}>
        {error}
      </div>
    );
  }

  if (!pdf) return null;

  return (
    <div className={cn("flex flex-col min-h-0 h-full", className)}>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
            title="이전 페이지"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs tabular-nums text-slate-600 min-w-[4.5rem] text-center">
            {pageNum} / {pdf.numPages}
          </span>
          <button
            type="button"
            disabled={pageNum >= pdf.numPages}
            onClick={() => setPageNum((p) => Math.min(pdf.numPages, p + 1))}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
            title="다음 페이지"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            className="p-1 rounded hover:bg-slate-200"
            title="축소"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[10px] text-slate-500 tabular-nums w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="p-1 rounded hover:bg-slate-200"
            title="확대"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-100 p-2 min-h-0">
        <canvas ref={canvasRef} className="mx-auto shadow-md bg-white max-w-full" />
      </div>
    </div>
  );
}
