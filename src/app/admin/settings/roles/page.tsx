"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  SETTINGS_KEYS,
  ADMIN_ROLE_ID,
  createRoleId,
  getDefaultRoles,
  type Role,
} from "@/lib/rolesSchema";

const MENU_ITEMS = [
  { id: "dashboard", label: "대시보드", path: "/" },
  { id: "cases", label: "사건 관리", path: "/cases" },
  { id: "board", label: "게시판", path: "/board" },
  { id: "calendar", label: "기일 달력", path: "/calendar" },
  { id: "consultation", label: "상담관리", path: "/consultation" },
  { id: "messenger", label: "메신저", path: "/messenger" },
  { id: "approval", label: "전자결재", path: "/approval" },
  { id: "finance", label: "회계/수납", path: "/finance" },
  { id: "stats", label: "통계/분석", path: "/stats" },
  { id: "staff", label: "직원 관리", path: "/staff" },
  { id: "notifications", label: "알림 설정", path: "/notifications" },
  { id: "settings", label: "시스템 설정", path: "/settings" },
];

function getDefaultPermissions(roleId: string): string[] {
  return roleId === ADMIN_ROLE_ID ? ["*"] : MENU_ITEMS.map((m) => m.id);
}

export default function AdminSettingsRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      const rawRoles = data[SETTINGS_KEYS.roles];
      const rawPerms = data[SETTINGS_KEYS.rolePermissions];

      if (Array.isArray(rawRoles) && rawRoles.length > 0) {
        setRoles(
          rawRoles.map((r: { id?: string; name?: string; status?: string; sortOrder?: number }) => ({
            id: r.id ?? createRoleId(),
            name: r.name ?? "역할",
            status: r.status === "pending_deletion" ? "pending_deletion" : "active",
            sortOrder: r.sortOrder,
          }))
        );
      } else {
        const defaultRoles = getDefaultRoles();
        setRoles(defaultRoles);
      }

      if (rawPerms && typeof rawPerms === "object") {
        setPermissions(rawPerms as Record<string, string[]>);
      } else {
        const initial: Record<string, string[]> = {};
        (Array.isArray(rawRoles) && rawRoles.length > 0 ? rawRoles : getDefaultRoles()).forEach(
          (r: { id: string }) => {
            initial[r.id] = getDefaultPermissions(r.id);
          }
        );
        setPermissions(initial);
      }
    } catch {
      const defaultRoles = getDefaultRoles();
      setRoles(defaultRoles);
      const initial: Record<string, string[]> = {};
      defaultRoles.forEach((r) => {
        initial[r.id] = getDefaultPermissions(r.id);
      });
      setPermissions(initial);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMenu = (roleId: string, menuId: string) => {
    if (roleId === ADMIN_ROLE_ID) return;
    setPermissions((prev) => {
      const list = prev[roleId] ?? [];
      if (list.includes("*")) return prev;
      const next = list.includes(menuId) ? list.filter((id) => id !== menuId) : [...list, menuId];
      return { ...prev, [roleId]: next };
    });
  };

  const setRoleAll = (roleId: string, checked: boolean) => {
    if (roleId === ADMIN_ROLE_ID) return;
    setPermissions((prev) => ({
      ...prev,
      [roleId]: checked ? MENU_ITEMS.map((m) => m.id) : [],
    }));
  };

  const handleAddRole = () => {
    const id = createRoleId();
    const newRole: Role = { id, name: "새 역할", status: "active", sortOrder: roles.length };
    setRoles((prev) => [...prev, newRole]);
    setPermissions((prev) => ({ ...prev, [id]: MENU_ITEMS.map((m) => m.id) }));
    setEditingId(id);
    setEditName("새 역할");
  };

  const startEdit = (role: Role) => {
    if (role.id === ADMIN_ROLE_ID) return;
    setEditingId(role.id);
    setEditName(role.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("역할 이름을 입력하세요.");
      return;
    }
    setRoles((prev) =>
      prev.map((r) => (r.id === editingId ? { ...r, name: trimmed } : r))
    );
    setEditingId(null);
    setEditName("");
  };

  const softDelete = (roleId: string) => {
    if (roleId === ADMIN_ROLE_ID) return;
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, status: "pending_deletion" as const } : r))
    );
    toast.info("삭제 대기 상태로 변경되었습니다. 완전 삭제하려면 다시 삭제를 누르세요.");
  };

  const hardDelete = (roleId: string) => {
    if (roleId === ADMIN_ROLE_ID) return;
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    setPermissions((prev) => {
      const next = { ...prev };
      delete next[roleId];
      return next;
    });
    if (editingId === roleId) cancelEdit();
    toast.success("역할이 완전히 삭제되었습니다.");
  };

  const handleDelete = (role: Role) => {
    if (role.id === ADMIN_ROLE_ID) return;
    if (role.status === "pending_deletion") {
      hardDelete(role.id);
    } else {
      softDelete(role.id);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [SETTINGS_KEYS.roles]: roles,
          [SETTINGS_KEYS.rolePermissions]: permissions,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("권한 설정이 저장되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const displayRoles = [...roles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="설정 목록으로"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield size={26} className="text-primary-600" />
              권한 관리
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              역할별 메뉴·데이터 접근 범위를 설정합니다. 역할을 등록·편집·삭제할 수 있습니다.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          leftIcon={<Plus size={16} />}
          onClick={handleAddRole}
        >
          역할 추가
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-medium text-slate-700 min-w-[180px]">
                  역할
                </th>
                {MENU_ITEMS.map((m) => (
                  <th
                    key={m.id}
                    className="text-left px-3 py-3 font-medium text-slate-600 max-w-[100px] truncate"
                    title={m.path}
                  >
                    {m.label}
                  </th>
                ))}
                <th className="text-left px-3 py-3 font-medium text-slate-600">
                  전체
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRoles.map((role) => {
                const list = permissions[role.id] ?? [];
                const isAdmin = role.id === ADMIN_ROLE_ID;
                const isAll =
                  isAdmin || list.includes("*") || list.length >= MENU_ITEMS.length;
                const isEditing = editingId === role.id;

                return (
                  <tr
                    key={role.id}
                    className={
                      role.status === "pending_deletion"
                        ? "border-b border-slate-100 bg-amber-50/50"
                        : "border-b border-slate-100"
                    }
                  >
                    <td className="px-5 py-3 font-medium text-slate-800 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="border border-slate-300 rounded px-2 py-1 text-sm w-28"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="p-1 rounded text-green-600 hover:bg-green-50"
                              aria-label="확인"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100"
                              aria-label="취소"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span>{role.name}</span>
                            {role.status === "pending_deletion" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                                삭제 대기
                              </span>
                            )}
                            {!isAdmin && role.status === "active" && (
                              <button
                                type="button"
                                onClick={() => startEdit(role)}
                                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                                aria-label="이름 편집"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {!isAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                onClick={() => handleDelete(role)}
                              >
                                {role.status === "pending_deletion"
                                  ? "완전 삭제"
                                  : "삭제"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    {MENU_ITEMS.map((m) => (
                      <td key={m.id} className="px-3 py-2 align-top">
                        {isAdmin ? (
                          <span className="text-slate-400">전체</span>
                        ) : role.status === "pending_deletion" ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <label className="cursor-pointer inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={list.includes(m.id)}
                              onChange={() => toggleMenu(role.id, m.id)}
                              className="rounded border-slate-300 text-primary-600"
                            />
                          </label>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 align-top">
                      {!isAdmin && role.status !== "pending_deletion" && (
                        <label className="cursor-pointer inline-flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={isAll}
                            onChange={(e) => setRoleAll(role.id, e.target.checked)}
                            className="rounded border-slate-300 text-primary-600"
                          />
                          전체
                        </label>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-slate-100">
          <Button onClick={handleSave} disabled={saving} leftIcon={<Save size={16} />}>
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
