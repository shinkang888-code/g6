"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle, FileDown } from "lucide-react";
import { downloadDeadlineExcelTemplate } from "@/lib/deadlineExcel";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { usePageTabTitle } from "@/lib/tabTitle";

export default function CalendarExcelUploadPage() {
  usePageTabTitle("기일 엑셀 업로드");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error("엑셀 파일을 선택하세요.");
      return;
    }
    const name = (file.name ?? "").toLowerCase();
    if (!name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      toast.error("엑셀 파일(.xls, .xlsx)만 업로드할 수 있습니다.");
      return;
    }
    setUploading(true);
    setDone(false);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/deadlines/import", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "반영 실패");
      setDone(true);
      toast.success(data.message ?? "기일이 반영되었습니다.");
      if (typeof window !== "undefined" && window.opener) {
        window.opener.postMessage({ type: "calendar-excel-upload-done" }, "*");
      }
      setTimeout(() => window.close(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "엑셀 반영 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-5 min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        <h1 className="text-lg font-bold text-slate-900 mb-1">기일 엑셀 업로드</h1>
        <p className="text-xs text-slate-500 mb-2">
          LawTop datelist 형식 엑셀을 올리면 DB에 반영되고 달력에 실시간 반영됩니다.
        </p>
        <button
          type="button"
          onClick={downloadDeadlineExcelTemplate}
          className="text-xs text-primary-600 hover:underline flex items-center gap-1 mb-4"
        >
          <FileDown size={12} /> 기일 등록 양식 다운로드
        </button>
        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-primary-600">
            <CheckCircle size={40} />
            <p className="text-sm font-medium">반영 완료</p>
            <p className="text-xs text-slate-500">창을 닫거나 잠시 후 자동으로 닫힙니다.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx"
              className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={uploading}
              leftIcon={uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            >
              {uploading ? "반영 중…" : "업로드 후 DB 반영"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
