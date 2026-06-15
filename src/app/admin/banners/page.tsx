"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Save,
  Upload,
  ExternalLink,
  Eye,
  EyeOff,
  ImageIcon,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

type BannerRow = {
  id?: string;
  clientId?: string;
  placement: string;
  item_order: number;
  title: string;
  image_url: string;
  link_url: string;
  active: boolean;
  management_number?: string | null;
};

const PLACEMENT = "legal_encyclopedia";

function rowKey(row: BannerRow) {
  return row.id ?? row.clientId ?? `banner-${row.item_order}`;
}

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "서버 응답이 비어 있습니다." : `요청 실패 (${res.status})`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("서버 응답을 해석할 수 없습니다. 잠시 후 다시 시도하세요.");
  }
}

export default function AdminBannersPage() {
  const [items, setItems] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/banners?placement=${PLACEMENT}`, {
        credentials: "include",
      });
      const json = await parseJsonResponse(res);
      if (!res.ok) throw new Error(String(json.error ?? "불러오기 실패"));
      setItems(Array.isArray(json.data) ? (json.data as BannerRow[]) : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "배너 목록을 불러올 수 없습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next.map((r, i) => ({ ...r, item_order: i })));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const payload = items.map((row, i) => ({
        placement: row.placement ?? PLACEMENT,
        item_order: i,
        title: row.title ?? "",
        image_url: row.image_url,
        link_url: row.link_url ?? "",
        active: row.active !== false,
        management_number: row.management_number ?? null,
      }));
      const res = await fetch("/api/admin/banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: payload }),
      });
      const json = await parseJsonResponse(res);
      if (!res.ok) throw new Error(String(json.error ?? "저장 실패"));
      toast.success(String(json.message ?? "배너가 저장되었습니다."));
      setItems(Array.isArray(json.data) ? (json.data as BannerRow[]) : items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    setEditing({
      clientId: `new-${Date.now()}`,
      placement: PLACEMENT,
      item_order: items.length,
      title: "",
      image_url: "",
      link_url: "",
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (row: BannerRow) => {
    setEditing({ ...row });
    setModalOpen(true);
  };

  const handleModalSave = async () => {
    if (!editing) return;
    if (!editing.image_url.trim()) {
      toast.error("광고 이미지 URL 또는 업로드가 필요합니다.");
      return;
    }
    const exists = items.some((r) => rowKey(r) === rowKey(editing));
    const nextItems = exists
      ? items.map((r) => (rowKey(r) === rowKey(editing) ? { ...editing } : r))
      : [...items, { ...editing, item_order: items.length }];

    setItems(nextItems);
    setModalOpen(false);
    setEditing(null);

    setSaving(true);
    try {
      const payload = nextItems.map((row, i) => ({
        placement: row.placement ?? PLACEMENT,
        item_order: i,
        title: row.title ?? "",
        image_url: row.image_url,
        link_url: row.link_url ?? "",
        active: row.active !== false,
        management_number: row.management_number ?? null,
      }));
      const res = await fetch("/api/admin/banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: payload }),
      });
      const json = await parseJsonResponse(res);
      if (!res.ok) throw new Error(String(json.error ?? "저장 실패"));
      toast.success(String(json.message ?? "배너가 저장되었습니다."));
      setItems(Array.isArray(json.data) ? (json.data as BannerRow[]) : nextItems);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다. 전체 저장을 다시 시도하세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row: BannerRow) => {
    if (!confirm("이 배너를 삭제하시겠습니까?")) return;
    setItems(items.filter((r) => rowKey(r) !== rowKey(row)));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/banners/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await parseJsonResponse(res);
      if (!res.ok) throw new Error(String(json.error ?? "업로드 실패"));
      const imageUrl = String(json.imageUrl ?? "");
      if (!imageUrl) throw new Error("이미지 URL을 받지 못했습니다.");
      setEditing((prev) => (prev ? { ...prev, image_url: imageUrl } : prev));
      toast.success(String(json.message ?? "이미지가 업로드되었습니다."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="text-amber-600" size={26} />
            배너광고 관리
          </h1>
          <p className="text-sm text-text-muted mt-1">
            로이고법률백과 우측 광고판 — 이미지·링크 등록, 드래그로 순서 변경, 미리보기(WYSIWYG) 확인
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openNew}>
            <Plus size={16} className="mr-1.5" />
            신규 광고
          </Button>
          <Button onClick={handleSaveAll} disabled={saving || loading}>
            <Save size={16} className="mr-1.5" />
            {saving ? "저장 중…" : "전체 저장"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">배너 목록 (드래그로 순서 변경)</span>
            <span className="text-xs text-slate-500">{items.length}개</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <ImageIcon size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-600">등록된 배너가 없습니다.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openNew}>
                첫 배너 추가
              </Button>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="banners">
                {(provided) => (
                  <ul ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-slate-100">
                    {items.map((row, index) => (
                      <Draggable key={rowKey(row)} draggableId={rowKey(row)} index={index}>
                        {(dragProvided, snapshot) => (
                          <li
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 bg-white",
                              snapshot.isDragging && "shadow-lg ring-2 ring-amber-200"
                            )}
                          >
                            <span {...dragProvided.dragHandleProps} className="text-slate-400 cursor-grab">
                              <GripVertical size={18} />
                            </span>
                            <div className="w-16 h-20 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={row.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-slate-900 truncate">
                                  {row.title || "(제목 없음)"}
                                </span>
                                {!row.active && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                    비활성
                                  </span>
                                )}
                              </div>
                              {row.link_url && (
                                <a
                                  href={row.link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 truncate flex items-center gap-1 mt-0.5"
                                >
                                  <ExternalLink size={10} />
                                  {row.link_url}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="sm" className="px-2" onClick={() => openEdit(row)}>
                                <Pencil size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" className="px-2" onClick={() => handleDelete(row)}>
                                <Trash2 size={16} className="text-red-500" />
                              </Button>
                            </div>
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
            <h2 className="text-xs font-bold text-slate-700 uppercase">미리보기 (WYSIWYG)</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">법률백과 우측 광고판 레이아웃</p>
          </div>
          <div className="h-[480px] overflow-y-auto p-2 space-y-3 bg-slate-50">
            {items.filter((r) => r.active).map((b) => (
              <div key={rowKey(b)} className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image_url} alt={b.title} className="w-full aspect-[4/5] object-cover" />
                {b.title && <p className="text-[10px] px-2 py-1.5 text-slate-600">{b.title}</p>}
              </div>
            ))}
            {items.filter((r) => r.active).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">활성 배너 없음</p>
            )}
          </div>
        </div>
      </div>

      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-slate-900 mb-4">
              {editing?.id || editing?.clientId?.startsWith("new") ? "배너 편집" : "신규 배너"}
            </Dialog.Title>

            {editing && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">제목 (선택)</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    placeholder="광고 제목"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">사이트 주소 (URL)</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={editing.link_url}
                    onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                    placeholder="https://"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">광고 이미지</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={editing.image_url}
                      onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                      placeholder="이미지 URL"
                    />
                    <label className="shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleImageUpload(f);
                        }}
                      />
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm cursor-pointer hover:bg-slate-50",
                          uploading && "opacity-50 pointer-events-none"
                        )}
                      >
                        <Upload size={14} />
                        {uploading ? "…" : "업로드"}
                      </span>
                    </label>
                  </div>
                  {editing.image_url && (
                    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editing.image_url} alt="미리보기" className="w-full max-h-48 object-contain bg-slate-50" />
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  {editing.active ? <Eye size={14} /> : <EyeOff size={14} />}
                  노출 활성
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleModalSave}>적용</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
