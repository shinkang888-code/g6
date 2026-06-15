"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  FolderOpen,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CompanyRegistryRow } from "@/lib/companyRegistry";
import { OrganizationFolderPanel } from "@/components/admin/OrganizationFolderPanel";
import { CompanyGroupSignupQueue } from "@/components/admin/CompanyGroupSignupQueue";

type TabId = "info" | "organizations" | "signup";

const TABS: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: "info", label: "기본 정보", icon: Building2 },
  { id: "organizations", label: "조직·구성원", icon: FolderOpen },
  { id: "signup", label: "가입 승인", icon: UserPlus },
];

export function CompanyRegistryClient() {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyRegistryRow[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
  const [adminRoleLabel, setAdminRoleLabel] = useState<string | null>(null);
  const [selectedMn, setSelectedMn] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("info");
  const [saving, setSaving] = useState(false);
  const [queueRefresh, setQueueRefresh] = useState(0);

  const [groupName, setGroupName] = useState("");
  const [memo, setMemo] = useState("");
  const [editMn, setEditMn] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newMn, setNewMn] = useState("");
  const [newName, setNewName] = useState("");
  const [newMemo, setNewMemo] = useState("");

  const selected = companies.find((c) => c.managementNumber === selectedMn) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/company-registry", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록 조회 실패");
      const rows = (data.data ?? []) as CompanyRegistryRow[];
      setCompanies(rows);
      setIsPlatformAdmin(Boolean(data.isPlatformAdmin));
      setIsPlatformSuperAdmin(Boolean(data.isPlatformSuperAdmin ?? data.isPlatformAdmin));
      setAdminRoleLabel(data.adminRoleLabel ?? null);
      setSelectedMn((prev) => {
        if (prev && rows.some((r) => r.managementNumber === prev)) return prev;
        return rows[0]?.managementNumber ?? null;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "회사 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) {
      setGroupName(selected.groupName);
      setMemo(selected.memo);
      setEditMn(selected.managementNumber);
    }
  }, [selected?.managementNumber, selected?.groupName, selected?.memo]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/company-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          managementNumber: newMn,
          groupName: newName.trim() || undefined,
          memo: newMemo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록 실패");
      toast.success(`관리번호 ${data.row.managementNumber} 회사를 등록했습니다.`);
      setShowCreate(false);
      setNewMn("");
      setNewName("");
      setNewMemo("");
      setSelectedMn(data.row.managementNumber);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedMn) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/company-registry/${encodeURIComponent(selectedMn)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          groupName: groupName.trim(),
          memo,
          managementNumber: isPlatformSuperAdmin && editMn !== selectedMn ? editMn : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      if (data.managementNumberChanged) {
        toast.success(`관리번호가 ${data.managementNumber}(으)로 변경되었습니다.`);
        setSelectedMn(data.managementNumber);
      } else {
        toast.success("회사 정보를 저장했습니다.");
      }
      await load();
      setQueueRefresh((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMn || !isPlatformSuperAdmin) return;
    if (!confirm(`관리번호 ${selectedMn} 회사를 삭제하시겠습니까? (구성원·사건이 없을 때만 가능)`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/company-registry/${encodeURIComponent(selectedMn)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      toast.success("회사를 삭제했습니다.");
      setSelectedMn(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">불러오는 중…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={24} className="text-primary-600" />
            회사·조직 관리
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            관리번호별 업무공간·조직·구성원·가입 승인
            {adminRoleLabel && (
              <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
                {adminRoleLabel}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load}>
            새로고침
          </Button>
          {isPlatformSuperAdmin && (
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              신규 회사
            </Button>
          )}
        </div>
      </div>

      {showCreate && isPlatformSuperAdmin && (
        <div className="bg-white rounded-2xl border border-primary-200 shadow-card p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">신규 관리번호 등록</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-text-muted">관리번호 (5자리)</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                inputMode="numeric"
                maxLength={5}
                placeholder="00002"
                value={newMn}
                onChange={(e) => setNewMn(e.target.value.replace(/\D/g, "").slice(0, 5))}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">회사명</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="법무법인 ○○"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">메모</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving || newMn.length < 1}>
              등록
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              취소
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-900">
            회사 목록 ({companies.length})
          </div>
          {companies.length === 0 ? (
            <p className="px-4 py-10 text-sm text-center text-text-muted">
              등록된 회사가 없습니다.
              {isPlatformSuperAdmin ? " 「신규 회사」로 관리번호를 추가하세요." : ""}
            </p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
              {companies.map((c) => (
                <button
                  key={c.managementNumber}
                  type="button"
                  onClick={() => setSelectedMn(c.managementNumber)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors",
                    selectedMn === c.managementNumber && "bg-primary-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900">{c.managementNumber}</span>
                    {c.pendingSignupCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        대기 {c.pendingSignupCount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 truncate mt-0.5">{c.groupName}</p>
                  <p className="text-xs text-text-muted mt-1">
                    구성원 {c.activeMemberCount}/{c.memberCount} · 조직 {c.organizationCount} · 사건 {c.caseCount}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-text-muted">
              왼쪽에서 회사를 선택하세요.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      tab === t.id ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <t.icon size={15} />
                    {t.label}
                    {t.id === "signup" && selected.pendingSignupCount > 0 && (
                      <span className="text-xs bg-amber-500 text-white rounded-full px-1.5">{selected.pendingSignupCount}</span>
                    )}
                  </button>
                ))}
              </div>

              {tab === "info" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Stat label="재직 구성원" value={`${selected.activeMemberCount} / ${selected.memberCount}`} icon={<Users size={16} />} />
                    <Stat label="조직 폴더" value={String(selected.organizationCount)} icon={<FolderOpen size={16} />} />
                    <Stat label="사건" value={String(selected.caseCount)} icon={<Building2 size={16} />} />
                  </div>

                  {isPlatformSuperAdmin && (
                    <div>
                      <label className="text-xs font-medium text-text-muted">관리번호 (5자리)</label>
                      <input
                        className="mt-1 w-full max-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tracking-widest"
                        inputMode="numeric"
                        maxLength={5}
                        value={editMn}
                        onChange={(e) => setEditMn(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-text-muted">회사명</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-muted">메모</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px]"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" leftIcon={<Save size={14} />} onClick={handleSave} disabled={saving}>
                      저장
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/admin/users">사용자 관리</Link>
                    </Button>
                    {isPlatformSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-danger-600 border-danger-200"
                        leftIcon={<Trash2 size={14} />}
                        onClick={handleDelete}
                        disabled={saving}
                      >
                        회사 삭제
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {tab === "organizations" && selectedMn && (
                <OrganizationFolderPanel
                  managementNumber={selectedMn}
                  onChanged={() => {
                    void load();
                    setQueueRefresh((k) => k + 1);
                  }}
                />
              )}

              {tab === "signup" && selectedMn && (
                <CompanyGroupSignupQueue managementNumber={selectedMn} refreshKey={queueRefresh} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-text-muted">{icon}{label}</div>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
