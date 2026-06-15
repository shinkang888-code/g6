"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  ADMIN_ROLE_LABELS,
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_DEPUTY_ROLE_ID,
} from "@/lib/adminRoles";

type PlatformUser = {
  id: string;
  login_id: string;
  name: string | null;
  permission_role_id: string | null;
  management_number: string | null;
};

export function SystemAdminRolePanel() {
  const [loading, setLoading] = useState(true);
  const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PlatformUser[]>([]);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      const sessionJson = await sessionRes.json();
      const superAdmin = Boolean(sessionJson.user?.isPlatformSuperAdmin);
      setIsPlatformSuperAdmin(superAdmin);

      if (!superAdmin) {
        setPlatformUsers([]);
        return;
      }

      const res = await fetch("/api/admin/users?scope=all&view=active", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록 조회 실패");

      const rows = (data.users ?? []) as PlatformUser[];
      setPlatformUsers(
        rows.filter(
          (u) =>
            u.permission_role_id === PLATFORM_ADMIN_ROLE_ID ||
            u.permission_role_id === PLATFORM_DEPUTY_ROLE_ID
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "플랫폼 관리자 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = async () => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/users?scope=all&view=active&q=${encodeURIComponent(q)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색 실패");
      setSearchResults((data.users ?? []).slice(0, 8));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "검색 실패");
    }
  };

  const assignRole = async (userId: string, roleId: string) => {
    const label = ADMIN_ROLE_LABELS[roleId] ?? roleId;
    if (!confirm(`해당 회원을 「${label}」(으)로 지정하시겠습니까?`)) return;

    setActing(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/permission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissionRoleId: roleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "권한 변경 실패");
      toast.success(`${label}(으)로 지정했습니다.`);
      await load();
      setSearchResults([]);
      setSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "권한 변경 실패");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted py-6 text-center">조직 관리 역할 불러오는 중…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Shield size={16} className="text-primary-600" />
          조직 관리 시스템 역할
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {[
            { id: PLATFORM_ADMIN_ROLE_ID, desc: "모든 회사·관리번호·전체부관리자 지정" },
            { id: PLATFORM_DEPUTY_ROLE_ID, desc: "전체 회사 업무 수행, 전체관리자 권한 변경 불가" },
            { id: "company_admin", desc: "해당 회사 사내관리자 (첫 가입자)" },
            { id: "company_co_admin", desc: "공동 사내관리자" },
          ].map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-800">{ADMIN_ROLE_LABELS[r.id] ?? r.id}</div>
              <div className="text-text-muted mt-0.5">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {isPlatformSuperAdmin ? (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <UserPlus size={16} className="text-primary-600" />
              전체부관리자 지정
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                placeholder="이름·ID·이메일 검색"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
              <Button size="sm" variant="outline" onClick={() => void runSearch()} disabled={acting}>
                검색
              </Button>
            </div>
            {searchResults.length > 0 && (
              <ul className="space-y-2 mb-4">
                {searchResults.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{u.name ?? u.login_id}</span>
                      <span className="text-xs text-text-muted ml-2">
                        {u.login_id}
                        {u.management_number ? ` · ${u.management_number}` : ""}
                      </span>
                    </div>
                    <Button
                      size="xs"
                      disabled={acting || u.permission_role_id === PLATFORM_DEPUTY_ROLE_ID}
                      onClick={() => assignRole(u.id, PLATFORM_DEPUTY_ROLE_ID)}
                    >
                      전체부관리자 지정
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-800">
              플랫폼 관리자 목록
            </div>
            {platformUsers.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-text-muted">등록된 플랫폼 관리자가 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500">
                    <th className="text-left px-4 py-2">ID</th>
                    <th className="text-left px-4 py-2">성명</th>
                    <th className="text-left px-4 py-2">관리번호</th>
                    <th className="text-left px-4 py-2">역할</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {platformUsers.map((u) => (
                    <tr key={u.id} className="border-t border-slate-50">
                      <td className="px-4 py-2 font-mono text-xs">{u.login_id}</td>
                      <td className="px-4 py-2">{u.name ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs">{u.management_number ?? "—"}</td>
                      <td className="px-4 py-2">
                        {ADMIN_ROLE_LABELS[u.permission_role_id ?? ""] ?? u.permission_role_id}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {u.permission_role_id === PLATFORM_DEPUTY_ROLE_ID && (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={acting}
                            onClick={() => assignRole(u.id, "role-staff")}
                          >
                            부관리자 해제
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          전체부관리자 지정은 <strong>전체관리자</strong>만 가능합니다.
        </p>
      )}
    </div>
  );
}
