"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewButton } from "@/components/pdf/PreviewButton";
import { toast } from "@/components/ui/toast";
import type { CaseItem } from "@/lib/types";
import type { CaseFile } from "@/lib/caseScopedStorage";
import { fetchCaseDocuments, uploadCaseFile } from "@/lib/caseFileStorage";
import { cn, formatFileSize } from "@/lib/utils";

type Props = {
  caseItem: CaseItem;
};

export function CaseFilesRoomPopup({ caseItem }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { files: next } = await fetchCaseDocuments(caseItem.id);
      setFiles(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "자료를 불러오지 못했습니다.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [caseItem.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selected.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of selected) {
      try {
        const { data } = await uploadCaseFile(caseItem.id, file);
        setFiles((prev) => [...prev, data]);
        ok++;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${file.name} 업로드 실패`);
      }
    }
    setUploading(false);
    if (ok > 0) toast.success(`${ok}개 파일이 추가되었습니다.`);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-slate-600">사건 자료실 — Drive·로컬 저장 파일</p>
        <div className="inline-flex">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Upload size={14} />}
            disabled={uploading}
            loading={uploading}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            파일 업로드
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm text-slate-500">자료를 불러오는 중…</div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200">
          <FileIcon size={36} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm">등록된 자료가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-card"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0",
                  file.mimeType?.includes("pdf")
                    ? "bg-danger-100 text-danger-700"
                    : "bg-primary-100 text-primary-700"
                )}
              >
                {file.mimeType?.includes("pdf") ? "PDF" : "FILE"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{file.fileName}</div>
                <div className="text-xs text-slate-500">{formatFileSize(file.fileSize)}</div>
              </div>
              <PreviewButton file={file} caseId={caseItem.id} size="sm" variant="outline" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
