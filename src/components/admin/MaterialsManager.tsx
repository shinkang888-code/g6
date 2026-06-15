// filepath: src/components/admin/MaterialsManager.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HardDrive,
  Search,
  Upload,
  Trash2,
  Download,
  Pencil,
  RefreshCw,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  File,
  FolderOpen,
  Check,
  X,
  Loader2,
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

type SourceFilter = "all" | CompanyFileItem["source"];

const SOURCE_LABEL: Record<CompanyFileItem["source"], string> = {
  company_shared: "회사 자료실",
  company_projects: "백과 프로젝트",
  case_files: "사건 자료",
};

const SOURCE_TABS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "company_shared", label: "회사 자료실" },
  { id: "case_files", label: "사건 자료" },
  { id: "company_projects", label: "백과" },
];

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon size={18} className="text-emerald-600" />;
  if (mimeType.includes("pdf")) return <FileText size={18} className="text-red-500" />;
  return <File size={18} className="text-slate-500" />;
}

export function MaterialsManager() {
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [files, setFiles] = useState<CompanyFileItem[]>([]);
  const [folderInfo, setFolderInfo] = useState<FolderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

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
        setFolderInfo({
          managementNumber: data.folders.managementNumber,
          driveFolderUrl: data.folders.driveFolderUrl,
          rootPath: data.folders.rootPath,
          sharedPath: data.folders.sharedPath,
          available: Boolean(data.folders.rootFolderId),
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "자료 목록 로드 실패");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const filteredFiles = useMemo(() => {
    if (sourceFilter === "all") return files;
    return files.filter((f) => f.source === sourceFilter);
  }, [files, sourceFilter]);

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
      toast.success(`${ok}개 파일이 Google Drive에 업로드되었습니다.`);
      void loadFiles(query);
    }
    setUploading(false);
  };

  const handleDelete = async (file: CompanyFileItem) => {
    if (!confirm(`「${file.displayName}」을(를) Google Drive에서 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/drive/company-files/${file.fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("삭제되었습니다.");
      if (editingId === file.fileId) setEditingId(null);
      void loadFiles(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const startRename = (file: CompanyFileItem) => {
    setEditingId(file.fileId);
    setEditName(file.displayName);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveRename = async (fileId: string) => {
    const name = editName.trim();
    if (!name) {
      toast.error("파일명을 입력하세요.");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/drive/company-files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("파일명이 변경되었습니다.");
      setEditingId(null);
      setEditName("");
      void loadFiles(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이름 변경 실패");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-indigo-600" />
          <span className="text-sm font-semibold text-slate-900">Google Drive 자료</span>
          {folderInfo?.managementNumber && (
            <span className="text-xs text-slate-500">
              관리번호 <code className="text-indigo-700 bg-indigo-50 px-1 rounded">{folderInfo.managementNumber}</code>
            </span>
          )}
        </div>
        <div className="flex-1" />
        {folderInfo?.driveFolderUrl && (
          <a
            href={folderInfo.driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-indigo-700 hover:bg-indigo-50"
          >
            <ExternalLink size={14} />
            Drive에서 열기
          </a>
        )}
        <Button variant="ghost" size="sm" onClick={() => loadFiles(query)} disabled={loading}>
          <RefreshCw size={16} className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-slate-100">
        <div className="flex-1 min-w-[200px] flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="파일명·경로·사건번호 검색"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
          <Button variant="outline" size="sm" onClick={handleSearch}>
            <Search size={16} />
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
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer",
              uploading
                ? "opacity-50 pointer-events-none border-slate-200 text-slate-400"
                : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            )}
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? "업로드 중…" : "업로드"}
          </span>
        </label>
      </div>

      <div className="px-4 py-2 flex flex-wrap gap-1 border-b border-slate-100">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSourceFilter(tab.id)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              sourceFilter === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {tab.label}
            {tab.id === "all" ? ` (${files.length})` : ` (${files.filter((f) => f.source === tab.id).length})`}
          </button>
        ))}
      </div>

      {!available && message && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {message}
          <p className="text-xs mt-1">
            <a href="/admin/settings/drive" className="text-indigo-700 underline">
              Google Drive 설정
            </a>
            에서 서비스 계정을 연결하세요.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-medium w-[40%]">파일명</th>
              <th className="px-3 py-2.5 font-medium">구분</th>
              <th className="px-3 py-2.5 font-medium">크기</th>
              <th className="px-3 py-2.5 font-medium">수정일</th>
              <th className="px-4 py-2.5 font-medium text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  불러오는 중…
                </td>
              </tr>
            ) : filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <FolderOpen size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-600">표시할 파일이 없습니다.</p>
                  <p className="text-xs text-slate-400 mt-1">업로드하거나 검색 조건을 변경해 보세요.</p>
                </td>
              </tr>
            ) : (
              filteredFiles.map((f) => (
                <tr key={f.fileId} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileTypeIcon mimeType={f.mimeType} />
                      {editingId === f.fileId ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveRename(f.fileId);
                              if (e.key === "Escape") cancelRename();
                            }}
                            className="flex-1 min-w-0 text-sm border border-indigo-300 rounded px-2 py-1"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-emerald-50 text-emerald-600"
                            onClick={() => void saveRename(f.fileId)}
                            disabled={savingName}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-slate-100 text-slate-500"
                            onClick={cancelRename}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{f.displayName}</p>
                          <p className="text-[11px] text-slate-400 truncate">{f.relativePath}</p>
                          {f.caseNumber && (
                            <p className="text-[11px] text-indigo-600">사건 {f.caseNumber}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                    {SOURCE_LABEL[f.source]}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {formatSize(f.size)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(f.modifiedTime ?? f.createdTime)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        title="파일명 수정"
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                        onClick={() => startRename(f)}
                        disabled={editingId === f.fileId}
                      >
                        <Pencil size={15} />
                      </button>
                      <a
                        href={`/api/drive/company-files/download/${f.fileId}`}
                        title="다운로드"
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                      >
                        <Download size={15} />
                      </a>
                      <button
                        type="button"
                        title="삭제"
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                        onClick={() => void handleDelete(f)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500">
          총 {filteredFiles.length}건
          {sourceFilter !== "all" && ` (전체 ${files.length}건)`}
        </div>
      )}
    </div>
  );
}
