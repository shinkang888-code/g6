"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, RefreshCw, Save, Trash2, Users, FolderOpen, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { CompanyGroupSummary } from "@/lib/tenantScope";
import { CompanyGroupSignupQueue } from "@/components/admin/CompanyGroupSignupQueue";

type GroupInfo = {
  managementNumber: string;
  groupName: string;
  memo: string;
  createdAt: string | null;
  updatedAt: string | null;
  hasRecord?: boolean;
};

export function CompanyGroupClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [summary, setSummary] = useState<CompanyGroupSummary | null>(null);
  const [managementNumberInput, setManagementNumberInput] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memo, setMemo] = useState("");
  const [queueRefresh, setQueueRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/company-groups", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "조회 실패");
      setGroup(data.group);
      setSummary(data.summary);
      setManagementNumberInput(data.group?.managementNumber ?? "");
      setGroupName(data.group?.groupName ?? "");
      setMemo(data.group?.memo ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "회사 그룹 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const mn = managementNumberInput.replace(/\D/g, "");
    if (mn.length > 5) {
      toast.error("관리번호는 5자리 숫자까지 입력할 수 있습니다.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/company-groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          managementNumber: mn || managementNumberInput,
          groupName: groupName.trim(),
          memo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");

      if (data.managementNumberChanged) {
        toast.success(`관리번호가 ${data.managementNumber}(으)로 변경되었습니다.`);
      } else {
        toast.success("회사 그룹 정보가 저장되었습니다.");
      }

      setGroup(data.group);
      setManagementNumberInput(data.group?.managementNumber ?? data.managementNumber ?? "");
      setQueueRefresh((k) => k + 1);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteManagementNumber = async () => {
    if (!confirm("회사 그룹 메타(그룹명·메모)만 삭제합니다. 사건·회원 데이터는 유지됩니다. 계속하시겠습니까?")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/company-groups", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      toast.success("회사 그룹 메타를 삭제했습니다. 관리번호를 다시 입력해 저장할 수 있습니다.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">불러오는 중…</p>;
  }

  const displayMn = group?.managementNumber ?? summary?.managementNumber ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={24} className="text-primary-600" />
            회사 그룹 (관리번호)
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            LawTop 스타일 — 동일 관리번호 구성원만 사건·고객·기일을 공유합니다.
          </p>
        </div>
        <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load}>
          새로고침
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Users size={18} />} label="구성원" value={`${summary?.activeMemberCount ?? 0} / ${summary?.memberCount ?? 0}`} hint="재직 / 전체" />
        <StatCard icon={<FolderOpen size={18} />} label="사건" value={String(summary?.caseCount ?? 0)} />
        <StatCard icon={<UserCircle size={18} />} label="의뢰인" value={String(summary?.clientCount ?? 0)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
        <div>
          <label htmlFor="managementNumber" className="text-xs font-medium text-text-muted">
            관리번호 (회사 키) — 5자리
          </label>
          <input
            id="managementNumber"
            inputMode="numeric"
            maxLength={5}
            className="mt-1 w-full max-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tracking-widest"
            value={managementNumberInput}
            onChange={(e) => setManagementNumberInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="00000"
          />
          <p className="text-xs text-text-muted mt-1">
            숫자 5자리 (예: 00000). 변경 시 해당 조직의 사건·회원·고객 데이터가 함께 이동합니다.
            {displayMn ? ` 현재: ${displayMn}` : ""}
          </p>
        </div>

        <div>
          <label htmlFor="groupName" className="text-xs font-medium text-text-muted">
            그룹명 (회사 표시명)
          </label>
          <input
            id="groupName"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="예: 법무법인 ○○"
          />
        </div>

        <div>
          <label htmlFor="memo" className="text-xs font-medium text-text-muted">
            메모
          </label>
          <textarea
            id="memo"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[88px]"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="회사 그룹 관련 메모"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" leftIcon={<Save size={14} />} onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/users">구성원 관리</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            className="text-danger-600 border-danger-200"
            onClick={handleDeleteManagementNumber}
            disabled={deleting}
          >
            그룹 메타 삭제
          </Button>
        </div>
      </div>

      {displayMn ? (
        <CompanyGroupSignupQueue managementNumber={displayMn} refreshKey={queueRefresh} />
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
      <div className="flex items-center gap-2 text-text-muted text-xs font-medium">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="text-xs text-text-muted mt-0.5">{hint}</p> : null}
    </div>
  );
}
