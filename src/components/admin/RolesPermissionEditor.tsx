"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  SETTINGS_KEYS,
  ADMIN_ROLE_ID,
  createRoleId,
  getDefaultRoles,
  isSystemRoleId,
  type Role,
} from "@/lib/rolesSchema";
import { PLATFORM_ADMIN_ROLE_ID, PLATFORM_DEPUTY_ROLE_ID } from "@/lib/adminRoles";

const MENU_ITEMS = [
  { id: "dashboard", label: "대시보드" },
  { id: "cases", label: "사건" },
  { id: "board", label: "게시판" },
  { id: "calendar", label: "기일" },
  { id: "consultation", label: "상담" },
  { id: "messenger", label: "메신저" },
  { id: "approval", label: "결재" },
  { id: "finance", label: "회계" },
  { id: "stats", label: "통계" },
  { id: "staff", label: "직원" },
  { id: "notifications", label: "알림" },
  { id: "settings", label: "설정" },
];

function getDefaultPermissions(roleId: string): string[] {
  if (roleId === ADMIN_ROLE_ID || roleId === PLATFORM_ADMIN_ROLE_ID || roleId === PLATFORM_DEPUTY_ROLE_ID) {
    return ["*"];
  }
  if (isSystemRoleId(roleId)) return ["*"];
  return MENU_ITEMS.map((m) => m.id);
}

function isFullAccessRole(roleId: string): boolean {
  return (
    roleId === ADMIN_ROLE_ID ||
    roleId === PLATFORM_ADMIN_ROLE_ID ||
    roleId === PLATFORM_DEPUTY_ROLE_ID ||
    isSystemRoleId(roleId)
  );
}

export function RolesPermissionEditor() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
        setRoles(getDefaultRoles());
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
    if (isFullAccessRole(roleId)) return;
    setPermissions((prev) => {
      const list = prev[roleId] ?? [];
      if (list.includes("*")) return prev;
      const next = list.includes(menuId) ? list.filter((id) => id !== menuId) : [...list, menuId];
      return { ...prev, [roleId]: next };
    });
  };

  const setRoleAll = (roleId: string, checked: boolean) => {
    if (isFullAccessRole(roleId)) return;
    setPermissions((prev) => ({
      ...prev,
      [roleId]: checked ? MENU_ITEMS.map((m) => m.id) : [],
    }));
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
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-text-muted text-sm">권한 설정 불러오는 중…</div>;
  }

  const displayRoles = [...roles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => {
            const id = createRoleId();
            setRoles((prev) => [...prev, { id, name: "새 역할", status: "active", sortOrder: prev.length }]);
            setPermissions((prev) => ({ ...prev, [id]: MENU_ITEMS.map((m) => m.id) }));
            setEditingId(id);
            setEditName("새 역할");
          }}
        >
          역할 추가
        </Button>
        <Button type="button" size="sm" leftIcon={<Save size={14} />} onClick={handleSave} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs min-w-[720px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[120px]">역할</th>
              {MENU_ITEMS.map((m) => (
                <th key={m.id} className="px-2 py-2 font-medium text-slate-600 whitespace-nowrap">
                  {m.label}
                </th>
              ))}
              <th className="px-2 py-2">전체</th>
            </tr>
          </thead>
          <tbody>
            {displayRoles.map((role) => {
              const list = permissions[role.id] ?? [];
              const isLocked = isFullAccessRole(role.id);
              const isAll = isLocked || list.includes("*") || list.length >= MENU_ITEMS.length;
              const isEditing = editingId === role.id;

              return (
                <tr key={role.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 align-top">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-xs"
                        />
                        <button type="button" onClick={() => {
                          setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, name: editName.trim() || r.name } : r)));
                          setEditingId(null);
                        }} className="p-1 text-primary-600"><Check size={12} /></button>
                        <button type="button" onClick={() => setEditingId(null)} className="p-1 text-slate-400"><X size={12} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className={cn("font-medium", role.status === "pending_deletion" && "line-through text-slate-400")}>
                          {role.name}
                        </span>
                        {!isLocked && (
                          <button type="button" onClick={() => { setEditingId(role.id); setEditName(role.name); }} className="p-0.5 text-slate-400 hover:text-primary-600">
                            <Pencil size={11} />
                          </button>
                        )}
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              if (role.status === "pending_deletion") {
                                setRoles((prev) => prev.filter((r) => r.id !== role.id));
                              } else {
                                setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, status: "pending_deletion" } : r)));
                              }
                            }}
                            className="p-0.5 text-slate-400 hover:text-danger-600"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  {MENU_ITEMS.map((m) => (
                    <td key={m.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isLocked || list.includes(m.id) || list.includes("*")}
                        disabled={isLocked}
                        onChange={() => toggleMenu(role.id, m.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isAll}
                      disabled={isLocked}
                      onChange={(e) => setRoleAll(role.id, e.target.checked)}
                      className="rounded border-slate-300"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">
        로그인 시 사용자의 권한 역할(permission_role_id)에 따라 메뉴 접근이 제한됩니다. 관리자 역할은 전체 메뉴 허용입니다.
      </p>
    </div>
  );
}
