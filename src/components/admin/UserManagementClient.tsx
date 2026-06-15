"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Shield,
  UserX,
  Search,
  RefreshCw,
  UserPlus,
  Pencil,
  LogOut,
  RotateCcw,
  History,
  FileUp,
  FileDown,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  ROLE_FILTER_GROUPS,
  USER_STATUS_LABELS,
  type SiteUserRow,
} from "@/lib/userAdmin";
import { RolesPermissionEditor } from "@/components/admin/RolesPermissionEditor";
import { AdminRoleAssignPanel } from "@/components/admin/AdminRoleAssignPanel";
import { SystemAdminRolePanel } from "@/components/admin/SystemAdminRolePanel";
import { ADMIN_ROLE_LABELS } from "@/lib/adminRoles";
import { downloadMemberExcelTemplate, exportMembersForReimport } from "@/lib/memberExcel";
import { exportMembersToExcel } from "@/lib/listExcelExports";

const ROLE_OPTIONS = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"] as const;

type OrgOption = { id: string; name: string };

function flattenOrgTree(
  nodes: Array<{ id: string; name: string; children?: typeof nodes }>,
  prefix = ""
): OrgOption[] {
  const out: OrgOption[] = [];
  for (const n of nodes) {
    const label = prefix ? `${prefix} / ${n.name}` : n.name;
    out.push({ id: n.id, name: label });
    if (n.children?.length) out.push(...flattenOrgTree(n.children, label));
  }
  return out;
}

type TabId = "users" | "permissions" | "resigned";

export function UserManagementClient() {
  const [tab, setTab] = useState<TabId>("users");
  const [users, setUsers] = useState<SiteUserRow[]>([]);
  const [pendingUsers, setPendingUsers] = useState<SiteUserRow[]>([]);
  const [signupQueue, setSignupQueue] = useState<SiteUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<SiteUserRow | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; summary: string | null; actor_login_id: string; created_at: string }>>([]);
  const [memoText, setMemoText] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerLoginId, setRegisterLoginId] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerRole, setRegisterRole] = useState<string>(ROLE_OPTIONS[3]);
  const [registerDepartment, setRegisterDepartment] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");

  const [editUser, setEditUser] = useState<SiteUserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editManagementNumber, setEditManagementNumber] = useState("");
  const [editOrganizationId, setEditOrganizationId] = useState("");
  const [editOrganizations, setEditOrganizations] = useState<OrgOption[]>([]);

  const [sessionFlags, setSessionFlags] = useState<{
    isPlatformSuperAdmin?: boolean;
    isPlatformDeputy?: boolean;
    isCompanySuperAdmin?: boolean;
    isPlatformStaff?: boolean;
  }>({});

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const u = data.user;
        if (!u) return;
        setSessionFlags({
          isPlatformSuperAdmin: Boolean(u.isPlatformSuperAdmin),
          isPlatformDeputy: Boolean(u.isPlatformDeputy),
          isCompanySuperAdmin: Boolean(u.isCompanySuperAdmin),
          isPlatformStaff: Boolean(u.isAnyPlatformStaff),
        });
      })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const view = tab === "resigned" ? "resigned" : "active";
      const params = new URLSearchParams({ view, role: roleFilter, q: appliedSearch });
      if (sessionFlags.isPlatformStaff) params.set("scope", "all");
      const queueParams = new URLSearchParams({ view: "signup-queue" });
      if (sessionFlags.isPlatformStaff) queueParams.set("scope", "all");
      const [activeRes, pendingRes, queueRes] = await Promise.all([
        fetch(`/api/admin/users?${params}`, { credentials: "include" }),
        tab === "users"
          ? fetch(`/api/admin/users?view=pending${sessionFlags.isPlatformStaff ? "&scope=all" : ""}`, { credentials: "include" })
          : Promise.resolve(null),
        tab === "users"
          ? fetch(`/api/admin/users?${queueParams}`, { credentials: "include" })
          : Promise.resolve(null),
      ]);
      const activeJson = await activeRes.json();
      if (!activeRes.ok) throw new Error(activeJson.error ?? "목록 조회 실패");
      setUsers(activeJson.users ?? []);

      if (pendingRes) {
        const pendingJson = await pendingRes.json();
        setPendingUsers(pendingJson.users ?? []);
      } else {
        setPendingUsers([]);
      }

      if (queueRes) {
        const queueJson = await queueRes.json();
        setSignupQueue(queueJson.users ?? []);
      } else {
        setSignupQueue([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [tab, roleFilter, appliedSearch, sessionFlags.isPlatformStaff]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!selectedUser) {
      setAuditLogs([]);
      setMemoText("");
      return;
    }
    fetch(`/api/admin/users/${selectedUser.id}/audit-logs`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setAuditLogs(j.logs ?? []))
      .catch(() => setAuditLogs([]));

    fetch(`/api/admin/users/${selectedUser.id}/memo`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setMemoText(j.content ?? ""))
      .catch(() => setMemoText(""));
  }, [selectedUser?.id]);

  const displayUsers = useMemo(() => users, [users]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runSearch = () => setAppliedSearch(search.trim());

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/approve`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "승인 실패");
      toast.success("사용대기가 해제되었습니다.");
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "승인 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignupReview = async (id: string, action: "approve" | "hold" | "reject") => {
    const labels = { approve: "승인", hold: "보류", reject: "거절" };
    let comment: string | undefined;
    if (action === "hold" || action === "reject") {
      const input = prompt(
        action === "hold" ? "보류 사유를 입력하세요. (선택)" : "거절 사유를 입력하세요. (선택)"
      );
      if (input === null) return;
      comment = input.trim() || undefined;
    } else if (!confirm("이 가입 신청을 승인하시겠습니까?")) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/signup-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${labels[action]} 실패`);
      toast.success(`가입 ${labels[action]} 처리되었습니다.`);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${labels[action]} 실패`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResign = async (type: "resigned" | "excluded" = "resigned") => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : selectedUser ? [selectedUser.id] : [];
    if (ids.length === 0) {
      toast.error("대상 사용자를 선택하세요.");
      return;
    }
    const label = type === "excluded" ? "제외" : "퇴사";
    if (!confirm(`선택한 ${ids.length}명을 ${label} 처리하시겠습니까?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/users/resign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리 실패");
      toast.success(
        data.message ??
          `${data.count ?? 0}명 ${label} 처리되었습니다. 계정이 삭제되어 새 관리번호로 재가입할 수 있습니다.`
      );
      setSelectedIds(new Set());
      setSelectedUser(null);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/reactivate`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "복직 실패");
      toast.success("복직 처리되었습니다.");
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "복직 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeForRejoin = async (user: SiteUserRow) => {
    if (
      !confirm(
        `"${user.name ?? user.login_id}" 계정을 삭제하고 재가입을 허용하시겠습니까?\n삭제 후 동일 Google/아이디로 다른 관리번호에 가입할 수 있습니다.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/users/resign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ids: [user.id],
          type: user.status === "excluded" ? "excluded" : "resigned",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "계정 삭제 실패");
      toast.success(data.message ?? "계정이 삭제되었습니다. 새 관리번호로 재가입할 수 있습니다.");
      setSelectedUser(null);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "계정 삭제 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegister = async () => {
    const loginId = registerLoginId.trim().toLowerCase();
    if (!loginId || loginId.length < 2) {
      toast.error("아이디를 2자 이상 입력하세요.");
      return;
    }
    if (!registerPassword || registerPassword.length < 4) {
      toast.error("비밀번호를 4자 이상 입력하세요.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          loginId,
          password: registerPassword,
          name: registerName.trim(),
          role: registerRole,
          department: registerDepartment.trim(),
          phone: registerPhone.trim(),
          email: registerEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록 실패");
      toast.success("사용자가 등록되었습니다.");
      setRegisterOpen(false);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = async (u: SiteUserRow) => {
    setEditUser(u);
    setEditName(u.name ?? "");
    setEditRole(u.role ?? ROLE_OPTIONS[3]);
    setEditDepartment(u.department ?? "");
    setEditPhone(u.phone ?? "");
    setEditEmail(u.email ?? "");
    setEditManagementNumber(u.management_number ?? "");
    setEditOrganizationId(u.organization_id ?? "");
    setEditOrganizations([]);

    const mn = u.management_number?.trim();
    if (mn) {
      try {
        const res = await fetch(`/api/admin/company-registry/${encodeURIComponent(mn)}/organizations`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.tree)) {
          setEditOrganizations(flattenOrgTree(data.tree));
        }
      } catch {
        /* ignore */
      }
    }
  };

  const reloadEditOrganizations = async (mnRaw: string) => {
    const mn = mnRaw.trim();
    if (!mn) {
      setEditOrganizations([]);
      setEditOrganizationId("");
      return;
    }
    try {
      const res = await fetch(`/api/admin/company-registry/${encodeURIComponent(mn)}/organizations`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.tree)) {
        setEditOrganizations(flattenOrgTree(data.tree));
      }
    } catch {
      setEditOrganizations([]);
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editName.trim() || null,
          role: editRole,
          department: editDepartment.trim() || null,
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          ...(sessionFlags.isPlatformSuperAdmin
            ? { managementNumber: editManagementNumber.trim() }
            : {}),
          organizationId: editOrganizationId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수정 실패");
      toast.success("저장되었습니다.");
      setEditUser(null);
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const saveMemo = async () => {
    if (!selectedUser) return;
    setMemoSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/memo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: memoText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "메모 저장 실패");
      toast.success("개인 메모가 저장되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "메모 저장 실패");
    } finally {
      setMemoSaving(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "users", label: "사용자관리", icon: <Users size={15} /> },
    { id: "permissions", label: "권한관리", icon: <Shield size={15} /> },
    { id: "resigned", label: "퇴사·제외", icon: <UserX size={15} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={24} className="text-primary-600" />
            사용자 관리
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            LawTop 스타일 계정·권한·퇴사 lifecycle 관리
            {sessionFlags.isPlatformSuperAdmin && (
              <span className="ml-2 text-xs text-primary-700 font-medium">· 전체 회사 회원 관리</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={fetchUsers}>
            새로고침
          </Button>
          {tab === "users" && (
            <>
              <Button variant="outline" size="sm" leftIcon={<FileDown size={14} />} onClick={() => downloadMemberExcelTemplate()}>
                양식
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileUp size={14} />}
                onClick={() =>
                  exportMembersForReimport(
                    users.map((u) => ({
                      id: u.id,
                      login_id: u.login_id,
                      management_number: u.management_number ?? "",
                      status: u.status,
                      name: u.name,
                      role: u.role,
                      created_at: u.created_at,
                      approved_at: u.approved_at ?? null,
                      approved_by: u.approved_by ?? null,
                      department: u.department,
                      email: u.email,
                      phone: u.phone,
                    }))
                  )
                }
              >
                엑셀
              </Button>
              <Button size="sm" leftIcon={<UserPlus size={14} />} onClick={() => setRegisterOpen(true)}>
                사용자 등록
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setSelectedIds(new Set()); setSelectedUser(null); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t.id ? "text-primary-600 border-primary-600" : "text-text-muted border-transparent hover:text-slate-700"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "permissions" ? (
        <div className="space-y-6">
          <SystemAdminRolePanel />
          <RolesPermissionEditor />
        </div>
      ) : (
        <>
          {tab === "users" && (
            <>
              {signupQueue.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-900">
                      가입 승인 대기 {signupQueue.filter((u) => u.status === "pending").length}명
                      {signupQueue.some((u) => u.status === "on_hold")
                        ? ` · 보류 ${signupQueue.filter((u) => u.status === "on_hold").length}명`
                        : ""}
                    </span>
                    <span className="text-xs text-amber-700">관리번호별 조직 회원</span>
                  </div>
                  <div className="space-y-2">
                    {signupQueue.map((u) => (
                      <div
                        key={u.id}
                        className="flex flex-wrap items-center gap-2 justify-between bg-white border border-amber-100 rounded-lg px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {u.name ?? u.login_id}
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {USER_STATUS_LABELS[u.status] ?? u.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {u.login_id}
                            {u.management_number ? ` · 관리번호 ${u.management_number}` : ""}
                            {u.email ? ` · ${u.email}` : ""}
                            {(u as SiteUserRow & { google_email?: string }).google_email
                              ? " · Google"
                              : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          <Button
                            size="xs"
                            disabled={actionLoading}
                            onClick={() => handleSignupReview(u.id, "approve")}
                          >
                            승인
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={actionLoading}
                            onClick={() => handleSignupReview(u.id, "hold")}
                          >
                            보류
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-danger-600 border-danger-200 hover:bg-danger-50"
                            disabled={actionLoading}
                            onClick={() => handleSignupReview(u.id, "reject")}
                          >
                            거절
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingUsers.length > 0 && signupQueue.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <span className="font-semibold text-amber-800">사용대기 {pendingUsers.length}명</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pendingUsers.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleApprove(u.id)}
                        disabled={actionLoading}
                        className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs hover:bg-amber-100"
                      >
                        {u.name ?? u.login_id} 승인
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-1 flex-wrap">
                  {ROLE_FILTER_GROUPS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setRoleFilter(g.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs border",
                        roleFilter === g.id
                          ? "bg-primary-50 text-primary-700 border-primary-200 font-medium"
                          : "bg-white text-slate-600 border-slate-200"
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 flex-1 min-w-[200px]">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    placeholder="이름·ID·부서·전화 검색"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <Button variant="outline" size="sm" leftIcon={<Search size={14} />} onClick={runSearch}>
                    검색
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" leftIcon={<LogOut size={14} />} disabled={actionLoading} onClick={() => handleResign("resigned")}>
                  퇴사 처리
                </Button>
                <Button variant="outline" size="sm" disabled={actionLoading} onClick={() => handleResign("excluded")}>
                  제외 처리
                </Button>
              </div>
            </>
          )}

          <div className="grid lg:grid-cols-[1fr_300px] gap-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    {tab === "users" && <th className="w-8 px-2 py-2" />}
                    <th className="text-left px-3 py-2">ID</th>
                    {sessionFlags.isPlatformStaff && (
                      <th className="text-left px-3 py-2">관리번호</th>
                    )}
                    <th className="text-left px-3 py-2">역할</th>
                    <th className="text-left px-3 py-2">성명</th>
                    <th className="text-left px-3 py-2">배치</th>
                    <th className="text-left px-3 py-2">연락처</th>
                    <th className="text-left px-3 py-2">상태</th>
                    {tab === "resigned" && <th className="text-left px-3 py-2">퇴사일</th>}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-text-muted">불러오는 중…</td></tr>
                  ) : displayUsers.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-text-muted">사용자가 없습니다.</td></tr>
                  ) : (
                    displayUsers.map((u) => (
                      <tr
                        key={u.id}
                        className={cn(
                          "border-b border-slate-100 hover:bg-slate-50 cursor-pointer",
                          selectedUser?.id === u.id && "bg-primary-50"
                        )}
                        onClick={() => setSelectedUser(u)}
                      >
                        {tab === "users" && (
                          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} className="rounded" />
                          </td>
                        )}
                        <td className="px-3 py-2 font-mono text-xs">{u.login_id}</td>
                        {sessionFlags.isPlatformStaff && (
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">
                            {u.management_number ?? "—"}
                          </td>
                        )}
                        <td className="px-3 py-2 text-xs">
                          {ADMIN_ROLE_LABELS[u.permission_role_id ?? ""] ?? u.role ?? "-"}
                        </td>
                        <td className="px-3 py-2 font-medium">{u.name ?? "-"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{u.department ?? "-"}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{u.phone || u.email || "-"}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {USER_STATUS_LABELS[u.status] ?? u.status}
                          </span>
                        </td>
                        {tab === "resigned" && (
                          <td className="px-3 py-2 text-xs tabular-nums text-slate-500">
                            {u.resigned_at ? new Date(u.resigned_at).toLocaleDateString("ko-KR") : "-"}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {tab === "resigned" ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button size="xs" variant="outline" leftIcon={<RotateCcw size={12} />} onClick={() => handleReactivate(u.id)} disabled={actionLoading}>
                                복직
                              </Button>
                              <Button size="xs" variant="outline" leftIcon={<LogOut size={12} />} onClick={() => handlePurgeForRejoin(u)} disabled={actionLoading}>
                                재가입 허용
                              </Button>
                            </div>
                          ) : (
                            <button type="button" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => openEdit(u)}>
                              <Pencil size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <aside className="space-y-3">
              {selectedUser && tab === "users" && (
                <AdminRoleAssignPanel
                  user={selectedUser}
                  sessionFlags={sessionFlags}
                  onUpdated={fetchUsers}
                />
              )}
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2">
                  <MessageSquare size={15} className="text-primary-600" />
                  개인 메모
                </div>
                {selectedUser ? (
                  <>
                    <p className="text-xs text-text-muted mb-2">{selectedUser.name} ({selectedUser.login_id})</p>
                    <textarea
                      value={memoText}
                      onChange={(e) => setMemoText(e.target.value)}
                      className="w-full min-h-[100px] text-sm border border-slate-200 rounded-lg p-2 resize-y"
                      placeholder="개인별 관리 메모"
                    />
                    <Button size="xs" className="mt-2 w-full" onClick={saveMemo} disabled={memoSaving}>
                      {memoSaving ? "저장 중…" : "메모 저장"}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-text-muted">사용자를 선택하면 메모를 편집할 수 있습니다.</p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-3 max-h-[220px] overflow-y-auto">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2">
                  <History size={15} className="text-primary-600" />
                  관리 이력
                </div>
                {selectedUser ? (
                  auditLogs.length === 0 ? (
                    <p className="text-xs text-text-muted">이력이 없습니다.</p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {auditLogs.map((log) => (
                        <li key={log.id} className="border-b border-slate-50 pb-1.5">
                          <div className="font-medium text-slate-700">{log.summary ?? log.action}</div>
                          <div className="text-text-muted">{log.actor_login_id} · {new Date(log.created_at).toLocaleString("ko-KR")}</div>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <p className="text-xs text-text-muted">사용자를 선택하세요.</p>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {registerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl border shadow-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">사용자 등록</h3>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="아이디" value={registerLoginId} onChange={(e) => setRegisterLoginId(e.target.value)} />
            <input type="password" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="비밀번호" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="성명" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
            <select className="w-full px-3 py-2 border rounded-lg text-sm" value={registerRole} onChange={(e) => setRegisterRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="소속부서" value={registerDepartment} onChange={(e) => setRegisterDepartment(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="이동전화" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="이메일" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setRegisterOpen(false)}>취소</Button>
              <Button onClick={handleRegister} disabled={actionLoading}>등록</Button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl border shadow-xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">정보 수정 · {editUser.login_id}</h3>
            {sessionFlags.isPlatformSuperAdmin && (
              <div>
                <label className="text-xs text-text-muted block mb-1">관리번호</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  placeholder="00000"
                  value={editManagementNumber}
                  onChange={(e) => {
                    setEditManagementNumber(e.target.value);
                  }}
                  onBlur={() => void reloadEditOrganizations(editManagementNumber)}
                />
              </div>
            )}
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="성명" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div>
              <label className="text-xs text-text-muted block mb-1">배치 (조직)</label>
              <select
                className="w-full px-3 py-2 border rounded-lg text-sm"
                value={editOrganizationId}
                onChange={(e) => {
                  const id = e.target.value;
                  setEditOrganizationId(id);
                  const org = editOrganizations.find((o) => o.id === id);
                  if (org) setEditDepartment(org.name);
                }}
              >
                <option value="">— 미배치 —</option>
                {editOrganizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="소속부서 (직접 입력)" value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="이동전화" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="이메일" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditUser(null)}>취소</Button>
              <Button onClick={handleEditSave} disabled={actionLoading}>저장</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
