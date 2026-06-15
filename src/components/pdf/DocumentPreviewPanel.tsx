"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { CaseFile } from "@/lib/caseScopedStorage";
import { resolveDocumentUrl, isPdfMime, openCaseFilePreview } from "@/lib/pdfPreview";
import { PdfCanvasViewer } from "@/components/pdf/PdfCanvasViewer";
import { Button } from "@/components/ui/button";

type Props = {
  file: CaseFile | null;
  caseId?: string;
  className?: string;
};

export function DocumentPreviewPanel({ file, caseId, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    if (file.url) {
      setUrl(file.url);
      return;
    }
    if (!file.driveFileId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveDocumentUrl(file)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file?.id, file?.url, file?.driveFileId]);

  if (!file) {
    return (
      <div className={`flex items-center justify-center text-[11px] text-text-muted px-2 text-center ${className ?? ""}`}>
        파일을 선택하거나 「미리보기」를 눌러 주세요.
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center text-xs text-slate-500 ${className ?? ""}`}>
        로딩 중…
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 text-xs text-slate-500 p-2 text-center ${className ?? ""}`}>
        <p className="font-medium truncate max-w-full">{file.fileName}</p>
        <p>미리보기 URL을 불러올 수 없습니다.</p>
      </div>
    );
  }

  const pdf = isPdfMime(file.mimeType, file.fileName);

  return (
    <div className={`flex flex-col min-h-0 h-full ${className ?? ""}`}>
      <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between gap-1 shrink-0">
        <p className="text-[10px] font-medium text-slate-700 truncate flex-1">{file.fileName}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          leftIcon={<ExternalLink size={11} />}
          onClick={() => void openCaseFilePreview(file, { caseId })}
        >
          새 창
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        {pdf ? (
          <PdfCanvasViewer url={url} className="h-full" />
        ) : file.mimeType?.startsWith("image/") ? (
          <div className="p-2 flex items-center justify-center h-full overflow-auto">
            <img src={url} alt={file.fileName} className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <iframe src={url} title={file.fileName} className="w-full h-full border-0 min-h-[120px]" />
        )}
      </div>
    </div>
  );
}
