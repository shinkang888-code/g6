// filepath: src/components/board/ai/encyclopedia/CompanyDriveExplorer.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Search,
  Upload,
  Trash2,
  Eye,
  ExternalLink,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  File,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type CompanyFileItem = {
  fileId: string;
  name: string;
  displayName: string;
  mimeType: string;
  size?: number;
  source: "company_shared" | "company_projects" | "case_files";
  relativePath: string;
  createdTime?: string;
  modifiedTime?: string;
  caseId?: string;
  caseNumber?: string;
};

type FolderInfo = {
  managementNumber: string;
  driveFolderUrl: string | null;
  rootPath: string;
  sharedPath: string;
  available: boolean;
};

const SOURCE_LABEL: Record<CompanyFileItem["source"], string> = {
  company_shared: "회사 자료실",
  company_projects: "백과 프로젝트",
  case_files: "사건 자료",
};

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon size={16} className="text-emerald-600" />;
  if (mimeType.includes("pdf")) return <FileText size={16} className="text-red-500" />;
  return <File size={16} className="text-slate-500" />;
}

export function CompanyDriveExplorer() {
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [files, setFiles] = useState<CompanyFileItem[]>([]);
  const [folderInfo, setFolderInfo] = useState<FolderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadFolder = useCallback(async () => {
    try {
      const res = await fetch("/api/drive/company-files/folder", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFolderInfo(data as FolderInfo);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadFiles = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/drive/company-files${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록을 불러올 수 없습니다.");
      setFiles(Array.isArray(data.files) ? data.files : []);
      setAvailable(data.available !== false);
      setMessage(data.message ?? null);
      if (data.folders) {
        setFolderInfo((prev) => ({
          managementNumber: data.folders.managementNumber,
          driveFolderUrl: data.folders.driveFolderUrl,
          rootPath: data.folders.rootPath,
          sharedPath: data.folders.sharedPath,
          available: Boolean(data.folders.rootFolderId),
        }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "자료실 로드 실패");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolder();
    void loadFiles();
  }, [loadFolder, loadFiles]);

  const handleSearch = () => {
    setQuery(searchInput);
    void loadFiles(searchInput);
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(fileList)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/drive/company-files/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `${file.name} 업로드 실패`);
      }
    }
    if (ok > 0) {
      toast.success(`${ok}개 파일이 자료실에 업로드되었습니다.`);
      void loadFiles(query);
    }
    setUploading(false);
  };

  const handleDelete = async (file: CompanyFileItem) => {
    if (!confirm(`「${file.displayName}」을(를) 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/drive/company-files/${file.fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("삭제되었습니다.");
      if (previewId === file.fileId) setPreviewId(null);
      void loadFiles(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const previewFile = useMemo(
    () => files.find((f) => f.fileId === previewId) ?? null,
    [files, previewId]
  );

  const previewUrl = previewId
    ? `/api/drive/company-files/download/${previewId}?inline=1`
    : null;

  const isPreviewable =
    previewFile &&
    (previewFile.mimeType.startsWith("image/") ||
      previewFile.mimeType.includes("pdf") ||
      previewFile.mimeType.startsWith("text/"));

  return (
    <div className="flex flex-col h-full min-h-[360px]">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <HardDrive size={14} className="text-indigo-600" />
          회사 자료실
          {folderInfo?.managementNumber && (
            <span className="font-normal text-slate-500">
              관리번호: <code className="text-indigo-700">{folderInfo.managementNumber}</code>
            </span>
          )}
        </div>
        <div className="flex-1" />
        {folderInfo?.driveFolderUrl && (
          <a
            href={folderInfo.driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white text-indigo-700 hover:bg-indigo-50"
          >
            <ExternalLink size={12} />
            Google Drive에서 열기
          </a>
        )}
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => loadFiles(query)} disabled={loading}>
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      <div className="px-3 py-2 flex gap-2 border-b border-slate-100">
        <div className="flex-1 flex gap-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="파일명·경로·사건번호 검색"
            className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5"
          />
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleSearch}>
            <Search size={14} />
          </Button>
        </div>
        <label>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer",
              uploading
                ? "opacity-50 pointer-events-none border-slate-200 text-slate-400"
                : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            )}
          >
            <Upload size={14} />
            {uploading ? "업로드 중…" : "업로드"}
          </span>
        </label>
      </div>

      {!available && message && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          {message}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-center text-xs text-slate-500">불러오는 중…</p>
          ) : files.length === 0 ? (
            <div className="p-8 text-center">
              <FolderOpen size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-600">파일이 없습니다.</p>
              <p className="text-[10px] text-slate-400 mt-1">
                업로드하거나 백과·사건 자료가 Drive에 저장되면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {files.map((f) => (
                <li
                  key={f.fileId}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 hover:bg-slate-50",
                    previewId === f.fileId && "bg-indigo-50"
                  )}
                >
                  <FileTypeIcon mimeType={f.mimeType} />
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setPreviewId(f.fileId)}
                  >
                    <p className="text-xs font-medium text-slate-900 truncate">{f.displayName}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {SOURCE_LABEL[f.source]}
                      {f.caseNumber ? ` · ${f.caseNumber}` : ""} · {formatSize(f.size)}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{f.relativePath}</p>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      title="미리보기"
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                      onClick={() => setPreviewId(f.fileId)}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      onClick={() => void handleDelete(f)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {previewFile && (
          <div className="w-64 shrink-0 border-l border-slate-200 bg-white flex flex-col">
            <div className="px-2 py-1.5 border-b border-slate-100 text-[10px] font-semibold text-slate-700 truncate">
              {previewFile.displayName}
            </div>
            <div className="flex-1 overflow-auto p-2">
              {isPreviewable && previewUrl ? (
                previewFile.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="max-w-full rounded border border-slate-200" />
                ) : previewFile.mimeType.includes("pdf") ? (
                  <iframe src={previewUrl} title="preview" className="w-full h-64 border rounded" />
                ) : (
                  <iframe src={previewUrl} title="preview" className="w-full h-48 border rounded text-[10px]" />
                )
              ) : (
                <div className="text-center py-8 text-[10px] text-slate-500">
                  <File size={28} className="mx-auto mb-2 text-slate-300" />
                  미리보기를 지원하지 않는 형식입니다.
                </div>
              )}
            </div>
            <div className="p-2 border-t border-slate-100 flex gap-1">
              <a
                href={`/api/drive/company-files/download/${previewFile.fileId}`}
                className="flex-1 text-center text-[10px] py-1.5 rounded border border-slate-200 hover:bg-slate-50"
              >
                다운로드
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
