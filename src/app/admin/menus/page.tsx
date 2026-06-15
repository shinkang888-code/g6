"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Menu,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Database,
  AlertCircle,
  LayoutPanelLeft,
  Smartphone,
  MoreHorizontal,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { MENU_ICON_OPTIONS } from "@/lib/menuIcons";
import type { MenuType } from "@/lib/menuService";
import { toast } from "@/components/ui/toast";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface MenuRow {
  id?: string;
  /** 새로 추가한 행 구분용 (DB 저장 시 제외) */
  clientId?: string;
  type: MenuType;
  item_order: number;
  item_id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number | null;
  roles?: string[] | null;
  lawtop_module?: string | null;
}

const TYPE_LABELS: Record<MenuType, string> = {
  lnb: "LNB (PC 사이드바)",
  mobile_main: "모바일 하단 메인",
  mobile_more: "모바일 더보기",
};

export default function AdminMenusPage() {
  const [items, setItems] = useState<MenuRow[]>([]);
  const [source, setSource] = useState<"db" | "default">("default");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuRow | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/menus");
      const json = await res.json();
      setItems(Array.isArray(json.data) ? json.data : []);
      setSource(json.source ?? "default");
    } catch {
      setItems([]);
      setSource("default");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const byType = (type: MenuType) =>
    items.filter((r) => r.type === type).sort((a, b) => a.item_order - b.item_order);

  const rowKey = (row: MenuRow) =>
    row.id ?? (row as MenuRow & { clientId?: string }).clientId ?? `${row.type}-${row.item_id}-${row.item_order}`;

  /** 현재 목록 전체를 DB에 저장 (기존 삭제 후 일괄 INSERT) */
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const payload = items.map((row) => ({
        type: row.type,
        item_order: row.item_order,
        item_id: row.item_id,
        label: row.label,
        href: row.href,
        icon: row.icon,
        badge: row.badge ?? null,
        roles: row.roles ?? null,
        lawtop_module: row.lawtop_module ?? null,
      }));
      const res = await fetch("/api/admin/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      toast.success("메뉴가 DB에 저장되었습니다.");
      setItems(Array.isArray(json.data) ? json.data : items);
      setSource(json.source ?? "db");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다. DB 연결을 확인하세요.");
    } finally {
      setSaving(false);
    }
  };

  /** DB에 id가 있으면 API 삭제, 없으면 로컬에서만 제거 */
  const handleDelete = async (row: MenuRow) => {
    if (!confirm("이 메뉴 항목을 삭제하시겠습니까?")) return;
    if (row.id) {
      try {
        const res = await fetch(`/api/admin/menus/${row.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("삭제되었습니다.");
        fetchMenus();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      }
    } else {
      const key = row.clientId ?? row.id ?? `${row.type}-${row.item_id}-${row.item_order}`;
      setItems((prev) =>
        prev.filter((r) => (r.clientId ?? r.id ?? `${r.type}-${r.item_id}-${r.item_order}`) !== key)
      );
      toast.success("목록에서 제거되었습니다. 저장 버튼을 누르면 DB에 반영됩니다.");
    }
  };

  const handleEdit = (row: MenuRow) => {
    setEditing({ ...row });
    setModalOpen(true);
  };

  const handleAdd = (type: MenuType) => {
    const nextOrder = Math.max(0, ...items.filter((r) => r.type === type).map((r) => r.item_order + 1));
    setEditing({
      type,
      item_order: nextOrder,
      item_id: `menu-${Date.now()}`,
      label: "",
      href: "/",
      icon: "FileText",
    });
    setModalOpen(true);
  };

  /** 드래그로 순서 변경 (같은 타입 내에서만) */
  const handleDragEnd = (result: DropResult, type: MenuType) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const typed = byType(type);
    const reordered = [...typed];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const withNewOrder = reordered.map((row, i) => ({ ...row, item_order: i }));
    setItems((prev) => [
      ...prev.filter((r) => r.type !== type),
      ...withNewOrder,
    ]);
    toast.success("순서가 변경되었습니다. 저장 버튼을 누르면 DB에 반영됩니다.");
  };

  /** 편집/추가 모달 저장: 로컬 state 반영. 실제 DB 반영은 "저장" 버튼으로 */
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editing.id) {
      setItems((prev) =>
        prev.map((r) => (r.id === editing.id ? { ...editing } : r))
      );
      toast.success("수정되었습니다. 아래 저장 버튼을 누르면 DB에 반영됩니다.");
    } else {
      const newRow: MenuRow = {
        ...editing,
        item_id: editing.item_id || `menu-${Date.now()}`,
        clientId: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      setItems((prev) => [...prev, newRow].sort((a, b) => a.item_order - b.item_order));
      toast.success("추가되었습니다. 아래 저장 버튼을 누르면 DB에 반영됩니다.");
    }
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Menu size={26} className="text-primary-600" />
            메뉴 관리
          </h1>
          <p className="text-sm text-text-muted mt-1">
            이용자 화면(LNB·모바일)에 노출되는 메뉴를 등록·편집·삭제한 뒤 저장하면 DB에 반영됩니다.
          </p>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={saving || items.length === 0}
          leftIcon={<Database size={16} />}
        >
          저장
        </Button>
      </div>

      {source === "db" && items.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-success-50 border border-success-200">
          <Database size={20} className="text-success-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-success-800">DB에 저장된 메뉴를 불러왔습니다.</p>
            <p className="text-xs text-success-700 mt-0.5">
              수정·추가·삭제 후 &quot;저장&quot; 버튼을 누르면 Supabase(site_menus)에 반영됩니다.
            </p>
          </div>
        </div>
      )}
      {source === "default" && items.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-100 border border-slate-200">
          <AlertCircle size={20} className="text-slate-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">현재 기본 메뉴를 표시 중입니다.</p>
            <p className="text-xs text-slate-600 mt-0.5">
              수정·추가·삭제 후 위 &quot;저장&quot; 버튼을 누르면 Supabase 테이블(site_menus)에 반영됩니다. DB 연결에 실패하면 기본 메뉴가 표시됩니다.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-text-muted">
          불러오는 중...
        </div>
      ) : (
        (["lnb", "mobile_main", "mobile_more"] as MenuType[]).map((type) => (
          <motion.section
            key={type}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                {type === "lnb" && <LayoutPanelLeft size={18} />}
                {type === "mobile_main" && <Smartphone size={18} />}
                {type === "mobile_more" && <MoreHorizontal size={18} />}
                {TYPE_LABELS[type]}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">드래그로 순서 변경</span>
                <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => handleAdd(type)}>
                  추가
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <DragDropContext onDragEnd={(r) => handleDragEnd(r, type)}>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/70 text-xs text-text-muted font-medium">
                      <th className="text-left px-2 py-3 w-8" />
                      <th className="text-left px-5 py-3 w-10">순서</th>
                      <th className="text-left px-5 py-3">라벨</th>
                      <th className="text-left px-5 py-3">경로</th>
                      <th className="text-left px-5 py-3 w-24">아이콘</th>
                      <th className="text-left px-5 py-3 w-20">배지</th>
                      <th className="text-right px-5 py-3 w-24">작업</th>
                    </tr>
                  </thead>
                  <Droppable droppableId={type}>
                    {(provided) => (
                      <tbody ref={provided.innerRef} {...provided.droppableProps}>
                        {byType(type).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-5 py-6 text-center text-sm text-text-muted">
                              메뉴가 없습니다. 추가 버튼으로 등록하세요.
                            </td>
                          </tr>
                        ) : (
                          byType(type).map((row, index) => (
                            <Draggable key={rowKey(row)} draggableId={rowKey(row)} index={index}>
                              {(provided, snapshot) => (
                                <tr
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    "border-t border-slate-50 text-sm",
                                    snapshot.isDragging && "bg-primary-50 shadow-md"
                                  )}
                                >
                                  <td className="px-2 py-3 text-slate-400" {...provided.dragHandleProps} title="드래그하여 순서 변경">
                                    <GripVertical size={16} />
                                  </td>
                                  <td className="px-5 py-3 tabular-nums text-text-muted">{row.item_order}</td>
                                  <td className="px-5 py-3 font-medium text-slate-800">{row.label}</td>
                                  <td className="px-5 py-3 text-text-muted">{row.href}</td>
                                  <td className="px-5 py-3 text-xs text-slate-600">{row.icon}</td>
                                  <td className="px-5 py-3">{row.badge != null ? row.badge : "-"}</td>
                                  <td className="px-5 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(row)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary-600"
                                      title="편집"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(row)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-danger-50 hover:text-danger-600 ml-1"
                                      title="삭제"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </table>
              </DragDropContext>
            </div>
          </motion.section>
        ))
      )}

      <Dialog.Root open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl border border-slate-200 p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {editing?.id ? "메뉴 편집" : "메뉴 추가"}
            </Dialog.Title>
            <form onSubmit={handleModalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">타입</label>
                <select
                  value={editing?.type ?? "lnb"}
                  onChange={(e) => setEditing((p) => (p ? { ...p, type: e.target.value as MenuType } : null))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  required
                >
                  <option value="lnb">LNB (PC 사이드바)</option>
                  <option value="mobile_main">모바일 하단 메인</option>
                  <option value="mobile_more">모바일 더보기</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">메뉴 ID (영문)</label>
                <input
                  type="text"
                  value={editing?.item_id ?? ""}
                  onChange={(e) => setEditing((p) => (p ? { ...p, item_id: e.target.value } : null))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  placeholder="dashboard, cases"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">라벨</label>
                <input
                  type="text"
                  value={editing?.label ?? ""}
                  onChange={(e) => setEditing((p) => (p ? { ...p, label: e.target.value } : null))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  placeholder="대시보드"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">경로 (href)</label>
                <input
                  type="text"
                  value={editing?.href ?? ""}
                  onChange={(e) => setEditing((p) => (p ? { ...p, href: e.target.value } : null))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  placeholder="/ 또는 /cases"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">아이콘</label>
                <select
                  value={editing?.icon ?? "FileText"}
                  onChange={(e) => setEditing((p) => (p ? { ...p, icon: e.target.value } : null))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  {MENU_ICON_OPTIONS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">순서</label>
                  <input
                    type="number"
                    value={editing?.item_order ?? 0}
                    onChange={(e) => setEditing((p) => (p ? { ...p, item_order: Number(e.target.value) } : null))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">배지 (숫자)</label>
                  <input
                    type="number"
                    value={editing?.badge ?? ""}
                    onChange={(e) => setEditing((p) => (p ? { ...p, badge: e.target.value === "" ? undefined : Number(e.target.value) } : null))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">권한 (쉼표 구분, 비우면 전체)</label>
                <input
                  type="text"
                  value={(editing?.roles ?? []).join(", ")}
                  onChange={(e) => setEditing((p) => (p ? { ...p, roles: e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined } : null))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  placeholder="관리자, 변호사"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">취소</Button>
                </Dialog.Close>
                <Button type="submit" disabled={saving}>{editing?.id ? "수정" : "추가"}</Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
