"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { OrganizationTreeNode } from "@/lib/companyOrganization";
import { USER_STATUS_LABELS, type SiteUserRow } from "@/lib/userAdmin";

type Props = {
  managementNumber: string;
  onChanged?: () => void;
};

export function OrganizationFolderPanel({ managementNumber, onChanged }: Props) {
  const [tree, setTree] = useState<OrganizationTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<SiteUserRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editName, setEditName] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const mnPath = encodeURIComponent(managementNumber);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/company-registry/${mnPath}/organizations`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "조직 조회 실패");
      setTree(data.tree ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "조직 조회 실패");
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [mnPath]);

  const loadMembers = useCallback(
    async (orgId: string | null) => {
      setMembersLoading(true);
      try {
        const q =
          orgId === null
            ? "organizationId=unassigned"
            : `organizationId=${encodeURIComponent(orgId)}`;
        const res = await fetch(`/api/admin/company-registry/${mnPath}/members?${q}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "구성원 조회 실패");
        setMembers(data.members ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "구성원 조회 실패");
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    },
    [mnPath]
  );

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (selectedId === "unassigned") {
      void loadMembers(null);
    } else if (selectedId) {
      void loadMembers(selectedId);
    } else {
      setMembers([]);
    }
  }, [selectedId, loadMembers]);

  const selectedNode = findNode(tree, selectedId);

  useEffect(() => {
    if (selectedNode) {
      setEditName(selectedNode.name);
      setEditMemo(selectedNode.memo ?? "");
    }
  }, [selectedNode?.id, selectedNode?.name, selectedNode?.memo]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error("조직명을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/company-registry/${mnPath}/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          parentId: selectedId && selectedId !== "unassigned" ? selectedId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      toast.success(`조직 "${name}"을(를) 생성했습니다.`);
      setNewFolderName("");
      await loadTree();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFolder = async () => {
    if (!selectedId || selectedId === "unassigned") return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/company-registry/${mnPath}/organizations/${selectedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: editName.trim(), memo: editMemo }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      toast.success("조직 정보를 저장했습니다.");
      await loadTree();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!selectedId || selectedId === "unassigned") return;
    if (!confirm(`조직 "${editName}"을(를) 삭제하시겠습니까? 소속 구성원은 미배치 상태가 됩니다.`)) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/company-registry/${mnPath}/organizations/${selectedId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      toast.success("조직을 삭제했습니다.");
      setSelectedId(null);
      await loadTree();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (userId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/company-registry/${mnPath}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, organizationId: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "이동 실패");
      toast.success("구성원을 미배치로 이동했습니다.");
      if (selectedId === "unassigned") await loadMembers(null);
      else if (selectedId) await loadMembers(selectedId);
      await loadTree();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이동 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToFolder = async (userId: string, organizationId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/company-registry/${mnPath}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, organizationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "배치 실패");
      toast.success("조직에 배치했습니다.");
      if (selectedId === "unassigned") await loadMembers(null);
      else if (selectedId) await loadMembers(selectedId);
      await loadTree();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "배치 실패");
    } finally {
      setSaving(false);
    }
  };

  const flatFolders = flattenTree(tree);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FolderOpen size={16} className="text-primary-600" />
            조직 폴더
          </h3>
          <Button variant="ghost" size="xs" onClick={loadTree} disabled={loading}>
            <RefreshCw size={13} />
          </Button>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-text-muted text-center">불러오는 중…</p>
        ) : (
          <div className="py-2">
            <button
              type="button"
              onClick={() => setSelectedId("unassigned")}
              className={cn(
                "w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50",
                selectedId === "unassigned" && "bg-primary-50 text-primary-800"
              )}
            >
              <UserMinus size={14} />
              미배치 구성원
            </button>
            {tree.map((node) => (
              <TreeNodeRow
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 space-y-2">
          <input
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="새 조직명"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
          <Button size="xs" className="w-full" leftIcon={<Plus size={13} />} onClick={handleCreateFolder} disabled={saving}>
            조직 추가
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {selectedId && selectedId !== "unassigned" && selectedNode ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">조직 편집</h3>
            <div>
              <label className="text-xs text-text-muted">조직명</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={selectedNode.name === "본사"}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">메모</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[60px]"
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" leftIcon={<Save size={14} />} onClick={handleSaveFolder} disabled={saving}>
                저장
              </Button>
              {selectedNode.name !== "본사" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger-600 border-danger-200"
                  leftIcon={<Trash2 size={14} />}
                  onClick={handleDeleteFolder}
                  disabled={saving}
                >
                  삭제
                </Button>
              )}
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users size={16} />
              {selectedId === "unassigned"
                ? "미배치 구성원"
                : selectedNode
                  ? `${selectedNode.name} 구성원 (${selectedNode.memberCount}명)`
                  : "구성원"}
            </h3>
          </div>
          {!selectedId ? (
            <p className="px-4 py-10 text-sm text-center text-text-muted">왼쪽에서 조직 폴더를 선택하세요.</p>
          ) : membersLoading ? (
            <p className="px-4 py-10 text-sm text-center text-text-muted">불러오는 중…</p>
          ) : members.length === 0 ? (
            <p className="px-4 py-10 text-sm text-center text-text-muted">구성원이 없습니다.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {members.map((m) => (
                <div key={m.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-medium text-slate-800">{m.name ?? m.login_id}</p>
                    <p className="text-xs text-text-muted font-mono">
                      {m.login_id} · {USER_STATUS_LABELS[m.status] ?? m.status}
                      {m.department ? ` · ${m.department}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedId !== "unassigned" && (
                      <Button size="xs" variant="outline" onClick={() => handleUnassign(m.id)} disabled={saving}>
                        미배치
                      </Button>
                    )}
                    {flatFolders.length > 0 && (
                      <select
                        className="text-xs rounded border border-slate-200 px-2 py-1 max-w-[140px]"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) void handleAssignToFolder(m.id, v);
                          e.target.value = "";
                        }}
                        disabled={saving}
                      >
                        <option value="">{selectedId === "unassigned" ? "조직에 배치…" : "다른 조직으로…"}</option>
                        {flatFolders
                          .filter((f) => f.id !== selectedId)
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {"—".repeat(f.depth)} {f.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: OrganizationTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const active = selectedId === node.id;
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "w-full text-left py-2 text-sm flex items-center gap-1 hover:bg-slate-50",
          active && "bg-primary-50 text-primary-800"
        )}
        style={{ paddingLeft: `${16 + depth * 14}px`, paddingRight: "16px" }}
      >
        {depth > 0 ? <ChevronRight size={12} className="text-slate-400 shrink-0" /> : null}
        <Folder size={14} className="shrink-0 text-amber-600" />
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-xs text-text-muted">{node.memberCount}</span>
      </button>
      {node.children.map((child) => (
        <TreeNodeRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

function findNode(tree: OrganizationTreeNode[], id: string | null): OrganizationTreeNode | null {
  if (!id) return null;
  for (const n of tree) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function flattenTree(tree: OrganizationTreeNode[], depth = 0): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  for (const n of tree) {
    out.push({ id: n.id, name: n.name, depth });
    out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}
