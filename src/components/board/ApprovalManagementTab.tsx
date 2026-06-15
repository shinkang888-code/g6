"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  Download,
  FolderPlus,
  FileText,
  GripVertical,
  Pencil,
  Trash2,
  FolderOpen,
  X,
  Check,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import type { ApprovalDoc } from "@/lib/types";
import { fetchApprovalManagementDocs } from "@/lib/approvalApi";
import {
  loadApprovalMeta,
  saveApprovalMeta,
  loadApprovalArchives,
  saveApprovalArchives,
  getOrCreateManagementNumber,
  type ApprovalDocMeta,
  type ApprovalArchiveFolder,
  type ApprovalArchiveItem,
  type ApprovalArchivesState,
} from "@/lib/approvalManagementStorage";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { dateStyle: "short" });
  } catch {
    return iso;
  }
}

export function ApprovalManagementTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [meta, setMeta] = useState<Record<string, ApprovalDocMeta>>(loadApprovalMeta);
  const [archives, setArchives] = useState<ApprovalArchivesState>(() => {
    const loaded = loadApprovalArchives();
    return {
      folders: Array.isArray(loaded.folders) ? loaded.folders : [],
      items: Array.isArray(loaded.items) ? loaded.items : [],
    };
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [editingMetaName, setEditingMetaName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [completedDocs, setCompletedDocs] = useState<ApprovalDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompletedDocs = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const docs = await fetchApprovalManagementDocs(q);
      setCompletedDocs(docs);
    } catch (e) {
      setCompletedDocs([]);
      toast.error(e instanceof Error ? e.message : "결재 문서를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompletedDocs();
  }, [loadCompletedDocs]);
  /** 날짜별 순번 계산용: 같은 날 결재완료된 문서 id 배열 (날짜·시간순) */
  const sameDayDocIdsByDate = useMemo(() => {
    const byDate = new Map<string, string[]>();
    const sorted = [...completedDocs].sort(
      (a, b) =>
        new Date(a.completedAt ?? a.createdAt).getTime() - new Date(b.completedAt ?? b.createdAt).getTime()
    );
    for (const doc of sorted) {
      const key = (doc.completedAt ?? doc.createdAt).slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(doc.id);
    }
    return byDate;
  }, [completedDocs]);

  const filtered = useMemo(() => {
    if (!appliedQuery.trim()) return completedDocs;
    const q = appliedQuery.trim().toLowerCase();
    return completedDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.caseNumber.toLowerCase().includes(q) ||
        d.requesterName.toLowerCase().includes(q) ||
        (meta[d.id]?.managementNumber ?? "").toLowerCase().includes(q) ||
        (meta[d.id]?.managementName ?? "").toLowerCase().includes(q)
    );
  }, [completedDocs, appliedQuery, meta]);

  const getMgmtNumber = useCallback(
    (doc: ApprovalDoc) => {
      const dateKey = (doc.completedAt ?? doc.createdAt).slice(0, 10);
      const sameDayIds = sameDayDocIdsByDate.get(dateKey) ?? [doc.id];
      return (
        meta[doc.id]?.managementNumber ??
        getOrCreateManagementNumber(doc.id, doc.completedAt ?? doc.createdAt, meta, sameDayIds)
      );
    },
    [meta, sameDayDocIdsByDate]
  );

  /** 저장되지 않은 관리번호가 있으면 자동 부여 후 저장 */
  useEffect(() => {
    let next = loadApprovalMeta();
    let changed = false;
    for (const doc of completedDocs) {
      if (next[doc.id]?.managementNumber) continue;
      const dateKey = (doc.completedAt ?? doc.createdAt).slice(0, 10);
      const sameDayIds = sameDayDocIdsByDate.get(dateKey) ?? [doc.id];
      const num = getOrCreateManagementNumber(doc.id, doc.completedAt ?? doc.createdAt, next, sameDayIds);
      next[doc.id] = { managementNumber: num, managementName: next[doc.id]?.managementName ?? "" };
      changed = true;
    }
    if (changed) {
      setMeta(next);
      saveApprovalMeta(next);
    }
  }, [completedDocs, sameDayDocIdsByDate]);

  const applySearch = () => {
    setAppliedQuery(searchQuery);
    void loadCompletedDocs(searchQuery.trim() || undefined);
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((d) => d.id)));
  };

  const saveMetaFor = (docId: string, managementNumber: string, managementName: string) => {
    const next = { ...meta, [docId]: { managementNumber, managementName } };
    setMeta(next);
    saveApprovalMeta(next);
    setEditingMetaId(null);
    toast.success("저장되었습니다.");
  };

  const startEditMeta = (doc: ApprovalDoc) => {
    const num = meta[doc.id]?.managementNumber ?? getMgmtNumber(doc);
    setEditingMetaId(doc.id);
    setEditingMetaName(meta[doc.id]?.managementName ?? "");
    setEditingMetaName((n) => n); // use state updater to avoid stale
  };

  const handleDownloadZip = async () => {
    if (selectedIds.size === 0) {
      toast.error("선택된 문서가 없습니다.");
      return;
    }
    try {
      const zip = new JSZip();
      const selected = filtered.filter((d) => selectedIds.has(d.id));
      for (const doc of selected) {
        const num = meta[doc.id]?.managementNumber ?? getMgmtNumber(doc);
        const name = meta[doc.id]?.managementName || doc.title;
        const content = [
          `관리번호: ${num}`,
          `관리명: ${name}`,
          `제목: ${doc.title}`,
          `문서종류: ${doc.type}`,
          `사건번호: ${doc.caseNumber}`,
          `기안자: ${doc.requesterName}`,
          `기안일: ${formatDate(doc.createdAt)}`,
          `결재완료: ${doc.completedAt ? formatDate(doc.completedAt) : "-"}`,
          `첨부: ${(doc.attachmentNames ?? []).join(", ") || "-"}`,
        ].join("\n");
        const safeName = `${num}_${(name || doc.title).replace(/[/\\?*:"]/g, "_").slice(0, 50)}`;
        zip.file(`${safeName}.txt`, content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `결재문서_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${selected.length}건이 ZIP으로 다운로드되었습니다.`);
    } catch (e) {
      toast.error("ZIP 생성에 실패했습니다.");
    }
  };

  const addToArchive = () => {
    if (selectedIds.size === 0) {
      toast.error("선택된 문서가 없습니다.");
      return;
    }
    const currentItems = Array.isArray(archives.items) ? archives.items : [];
    const nextItems = [...currentItems];
    const existingDocIds = new Set(currentItems.map((i) => i.approvalDocId));
    for (const id of selectedIds) {
      if (existingDocIds.has(id)) continue;
      const doc = completedDocs.find((d) => d.id === id);
      if (!doc) continue;
      const displayName = meta[doc.id]?.managementName || doc.title;
      nextItems.push({
        id: `arch-${Date.now()}-${id}`,
        approvalDocId: id,
        folderId: null,
        displayName,
      });
      existingDocIds.add(id);
    }
    const next: ApprovalArchivesState = {
      folders: Array.isArray(archives.folders) ? archives.folders : [],
      items: nextItems,
    };
    setArchives(next);
    saveApprovalArchives(next);
    toast.success("자료실에 추가되었습니다.");
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const id = `folder-${Date.now()}`;
    const folders = Array.isArray(archives.folders) ? archives.folders : [];
    const next: ApprovalArchivesState = {
      folders: [...folders, { id, name: newFolderName.trim() }],
      items: Array.isArray(archives.items) ? archives.items : [],
    };
    setArchives(next);
    saveApprovalArchives(next);
    setNewFolderName("");
    toast.success("폴더가 생성되었습니다.");
  };

  const updateFolderName = (folderId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("폴더명을 입력하세요.");
      return;
    }
    const folders = Array.isArray(archives.folders) ? archives.folders : [];
    const next: ApprovalArchivesState = {
      folders: folders.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f)),
      items: Array.isArray(archives.items) ? archives.items : [],
    };
    setArchives(next);
    saveApprovalArchives(next);
    setEditingFolderId(null);
    toast.success("폴더명이 저장되었습니다.");
  };

  const deleteFolder = (folderId: string) => {
    setFolderContextMenu(null);
    if (!confirm("폴더를 삭제하면 안의 항목은 루트로 이동합니다. 계속할까요?")) return;
    const folders = Array.isArray(archives.folders) ? archives.folders : [];
    const items = Array.isArray(archives.items) ? archives.items : [];
    const next: ApprovalArchivesState = {
      folders: folders.filter((f) => f.id !== folderId),
      items: items.map((i) => (i.folderId === folderId ? { ...i, folderId: null } : i)),
    };
    setArchives(next);
    saveApprovalArchives(next);
    setEditingFolderId(null);
    toast.success("폴더가 삭제되었습니다.");
  };

  const startEditFolder = (folderId: string) => {
    const folder = (Array.isArray(archives.folders) ? archives.folders : []).find((f) => f.id === folderId);
    if (folder) {
      setEditingFolderId(folder.id);
      setEditingFolderName(folder.name);
      setFolderContextMenu(null);
    }
  };

  const updateItemName = (itemId: string, displayName: string) => {
    const items = Array.isArray(archives.items) ? archives.items : [];
    const next: ApprovalArchivesState = {
      folders: Array.isArray(archives.folders) ? archives.folders : [],
      items: items.map((i) => (i.id === itemId ? { ...i, displayName } : i)),
    };
    setArchives(next);
    saveApprovalArchives(next);
    setEditingItemId(null);
  };

  const moveItemToFolder = (itemId: string, folderId: string | null) => {
    const items = Array.isArray(archives.items) ? archives.items : [];
    const next: ApprovalArchivesState = {
      folders: Array.isArray(archives.folders) ? archives.folders : [],
      items: items.map((i) => (i.id === itemId ? { ...i, folderId } : i)),
    };
    setArchives(next);
    saveApprovalArchives(next);
  };

  const deleteArchiveItem = (itemId: string) => {
    const items = Array.isArray(archives.items) ? archives.items : [];
    const next: ApprovalArchivesState = {
      folders: Array.isArray(archives.folders) ? archives.folders : [],
      items: items.filter((i) => i.id !== itemId),
    };
    setArchives(next);
    saveApprovalArchives(next);
    toast.success("자료실에서 제거되었습니다.");
  };

  const onArchiveDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const itemId = result.draggableId;
    if (itemId.startsWith("folder-")) return;
    const destId = result.destination.droppableId;
    const folderId = destId === "archive-root" ? null : destId;
    moveItemToFolder(itemId, folderId);
  };

  const safeItems = Array.isArray(archives.items) ? archives.items : [];
  const safeFolders = Array.isArray(archives.folders) ? archives.folders : [];
  const rootItems = safeItems.filter((i) => !i.folderId);
  const getFolderItems = (folderId: string) => safeItems.filter((i) => i.folderId === folderId);

  useEffect(() => {
    if (!folderContextMenu) return;
    const close = () => setFolderContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [folderContextMenu]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-600">결재관리</h2>
      <p className="text-xs text-text-muted">
        결재완료된 문서를 검색·다운로드하고, 관리번호/관리명을 부여할 수 있습니다. 중요한 문서는 우측 자료실로 드래그하여 보관하세요.
      </p>

      <div className="flex gap-4 flex-col lg:flex-row min-h-[500px]">
        {/* 좌측: 결재 문서 목록 */}
        <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                placeholder="제목, 사건번호, 기안자, 관리번호 검색..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <Button size="sm" onClick={applySearch} leftIcon={<Search size={14} />}>
              검색
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadZip}
              disabled={selectedIds.size === 0}
              leftIcon={<Download size={14} />}
            >
              선택 ZIP 다운로드 ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={addToArchive}
              disabled={selectedIds.size === 0}
              leftIcon={<FolderPlus size={14} />}
            >
              자료실에 추가
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">관리번호</th>
                  <th className="px-3 py-2 text-left">관리명</th>
                  <th className="px-3 py-2 text-left">제목</th>
                  <th className="px-3 py-2 text-left">상태</th>
                  <th className="px-3 py-2 text-left">기안자</th>
                  <th className="px-3 py-2 text-left">기안일</th>
                  <th className="px-3 py-2 text-left">첨부</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const num = meta[doc.id]?.managementNumber ?? getMgmtNumber(doc);
                  const isEditing = editingMetaId === doc.id;
                  return (
                    <tr
                      key={doc.id}
                      className="border-t border-slate-50 hover:bg-slate-50/50"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "approval-doc", id: doc.id }));
                      }}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{num}</td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingMetaName}
                              onChange={(e) => setEditingMetaName(e.target.value)}
                              className="w-32 px-2 py-1 text-xs border rounded"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveMetaFor(doc.id, num, editingMetaName);
                                if (e.key === "Escape") setEditingMetaId(null);
                              }}
                            />
                            <button type="button" onClick={() => saveMetaFor(doc.id, num, editingMetaName)}>
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMetaId(doc.id);
                              setEditingMetaName(meta[doc.id]?.managementName ?? "");
                            }}
                            className="text-left hover:bg-slate-100 rounded px-1 -mx-1 flex items-center gap-1"
                          >
                            {meta[doc.id]?.managementName || "-"}
                            <Pencil size={12} className="text-slate-400" />
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium truncate max-w-[180px]">{doc.title}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs bg-success-100 text-success-700 rounded px-1.5 py-0.5">{doc.status}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{doc.requesterName}</td>
                      <td className="px-3 py-2 text-slate-500">{formatDate(doc.createdAt)}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {(doc.attachmentNames ?? []).length > 0 ? `${doc.attachmentNames!.length}개` : "-"}
                      </td>
                      <td />
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">결재 문서를 불러오는 중…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                {completedDocs.length === 0 ? "결재완료된 문서가 없습니다." : "검색 결과가 없습니다."}
              </div>
            ) : null}
          </div>
        </div>

        {/* 우측: 자료실 */}
        <div className="w-full lg:w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">자료실</span>
          </div>
          <div className="p-2 border-b border-slate-100 flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newFolderName.trim() && createFolder()}
              placeholder="새 폴더명 (입력 후 Enter 또는 폴더 생성)"
              className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
            />
            <Button
              size="xs"
              onClick={createFolder}
              disabled={!newFolderName.trim()}
              leftIcon={<FolderPlus size={12} />}
            >
              폴더 생성
            </Button>
          </div>
          {folderContextMenu && (
            <div
              className="fixed z-50 min-w-[140px] py-1 bg-white border border-slate-200 rounded-lg shadow-lg text-xs"
              style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2"
                onClick={() => startEditFolder(folderContextMenu.folderId)}
              >
                <Pencil size={12} />
                이름 변경
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center gap-2 text-danger-600"
                onClick={() => deleteFolder(folderContextMenu.folderId)}
              >
                <Trash2 size={12} />
                폴더 삭제
              </button>
            </div>
          )}
          <div
            className="flex-1 min-h-0 overflow-auto p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              try {
                const raw = e.dataTransfer.getData("application/json");
                const data = JSON.parse(raw);
                if (data.type === "approval-doc" && data.id) {
                  const doc = completedDocs.find((d) => d.id === data.id);
                  const currentItems = Array.isArray(archives.items) ? archives.items : [];
                  if (doc && !currentItems.some((i) => i.approvalDocId === data.id)) {
                    const displayName = meta[doc.id]?.managementName || doc.title;
                    const next: ApprovalArchivesState = {
                      folders: Array.isArray(archives.folders) ? archives.folders : [],
                      items: [
                        ...currentItems,
                        { id: `arch-${Date.now()}-${data.id}`, approvalDocId: data.id, folderId: null, displayName },
                      ],
                    };
                    setArchives(next);
                    saveApprovalArchives(next);
                    toast.success("자료실에 추가되었습니다.");
                  }
                }
              } catch {}
            }}
          >
            <DragDropContext onDragEnd={onArchiveDragEnd}>
              <div className="space-y-2">
                {safeFolders.map((folder) => (
                  <div key={folder.id} className="rounded-lg border border-slate-200 bg-slate-50/50">
                    <div
                      className="flex items-center gap-1 px-2 py-1.5"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (editingFolderId === folder.id) return;
                        setFolderContextMenu({ folderId: folder.id, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <FolderOpen size={14} className="text-slate-500 shrink-0" />
                      {editingFolderId === folder.id ? (
                        <>
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            className="flex-1 px-1 py-0.5 text-xs border rounded min-w-0"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingFolderName.trim()) updateFolderName(folder.id, editingFolderName.trim());
                              if (e.key === "Escape") setEditingFolderId(null);
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => editingFolderName.trim() && updateFolderName(folder.id, editingFolderName.trim())}
                            className="p-0.5 text-slate-600 hover:text-slate-800"
                          >
                            <Check size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className="text-xs font-medium flex-1 truncate cursor-pointer select-none"
                            onDoubleClick={() => startEditFolder(folder.id)}
                            title="더블클릭: 이름 수정"
                          >
                            {folder.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditFolder(folder.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-600"
                            title="이름 수정"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFolder(folder.id)}
                            className="p-0.5 text-slate-400 hover:text-danger-500"
                            title="폴더 삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                    <Droppable droppableId={folder.id}>
                      {(fp) => (
                        <div ref={fp.innerRef} {...fp.droppableProps} className="pl-3 pb-1 space-y-1 min-h-[28px]">
                          {getFolderItems(folder.id).map((item, idx) => (
                            <Draggable key={item.id} draggableId={item.id} index={idx}>
                              {(dp) => (
                                <div ref={dp.innerRef} {...dp.draggableProps} className="flex items-center gap-1 py-1 text-xs group">
                                  <span {...dp.dragHandleProps} className="text-slate-300 cursor-grab">
                                    <GripVertical size={12} />
                                  </span>
                                  {editingItemId === item.id ? (
                                    <>
                                      <input
                                        value={editingItemName}
                                        onChange={(e) => setEditingItemName(e.target.value)}
                                        className="flex-1 px-1 py-0.5 border rounded"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") updateItemName(item.id, editingItemName);
                                          if (e.key === "Escape") setEditingItemId(null);
                                        }}
                                      />
                                      <button onClick={() => updateItemName(item.id, editingItemName)}>
                                        <Check size={12} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex-1 truncate">{item.displayName}</span>
                                      <button onClick={() => { setEditingItemId(item.id); setEditingItemName(item.displayName); }} className="opacity-0 group-hover:opacity-100 p-0.5">
                                        <Pencil size={11} />
                                      </button>
                                      <button onClick={() => deleteArchiveItem(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-danger-500">
                                        <Trash2 size={11} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {fp.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
                <div className="text-[11px] text-slate-500 px-1 py-1">루트 (좌측 목록에서 드래그하여 추가)</div>
                <Droppable droppableId="archive-root">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                      {rootItems.map((item, idx) => (
                        <Draggable key={item.id} draggableId={item.id} index={idx}>
                          {(dp) => (
                            <div ref={dp.innerRef} {...dp.draggableProps} className="flex items-center gap-1 px-2 py-1.5 rounded border border-slate-100 bg-white group">
                              <span {...dp.dragHandleProps} className="text-slate-300 cursor-grab">
                                <GripVertical size={12} />
                              </span>
                              <FileText size={12} className="text-slate-400 shrink-0" />
                              {editingItemId === item.id ? (
                                <>
                                  <input
                                    value={editingItemName}
                                    onChange={(e) => setEditingItemName(e.target.value)}
                                    className="flex-1 px-1 py-0.5 text-xs border rounded"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") updateItemName(item.id, editingItemName);
                                      if (e.key === "Escape") setEditingItemId(null);
                                    }}
                                  />
                                  <button onClick={() => updateItemName(item.id, editingItemName)}>
                                    <Check size={12} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1 truncate text-xs">{item.displayName}</span>
                                  <button onClick={() => { setEditingItemId(item.id); setEditingItemName(item.displayName); }} className="opacity-0 group-hover:opacity-100 p-0.5">
                                    <Pencil size={11} />
                                  </button>
                                  <button onClick={() => deleteArchiveItem(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-danger-500">
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </DragDropContext>
          </div>
        </div>
      </div>
    </section>
  );
}
