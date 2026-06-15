"use client";

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ADMIN_ROLE_LABELS } from "@/lib/adminRoles";
import type { SiteUserRow } from "@/lib/userAdmin";

const PLATFORM_ROLES = [
  { id: "platform_admin", label: "전체관리자" },
  { id: "platform_deputy", label: "전체부관리자" },
] as const;

const COMPANY_ROLES = [
  { id: "company_admin", label: "사내관리자" },
  { id: "company_co_admin", label: "공동사내관리자" },
] as const;

type Props = {
  user: SiteUserRow;
  sessionFlags?: {
    isPlatformSuperAdmin?: boolean;
    isPlatformDeputy?: boolean;
    isCompanySuperAdmin?: boolean;
  };
  onUpdated?: () => void;
};

export function AdminRoleAssignPanel({ user, sessionFlags, onUpdated }: Props) {
  const currentLabel =
    ADMIN_ROLE_LABELS[user.permission_role_id ?? ""] ??
    (user.role === "관리자" ? "사내관리자" : null);

  const assign = async (permissionRoleId: string) => {
    const label = ADMIN_ROLE_LABELS[permissionRoleId] ?? permissionRoleId;
    if (!confirm(`${user.name ?? user.login_id}님을 「${label}」(으)로 지정하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}/permission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissionRoleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "권한 변경 실패");
      toast.success(`${label}(으)로 변경했습니다.`);
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "권한 변경 실패");
    }
  };

  const showPlatform = sessionFlags?.isPlatformSuperAdmin;
  const showCompany =
    sessionFlags?.isPlatformSuperAdmin ||
    sessionFlags?.isPlatformDeputy ||
    sessionFlags?.isCompanySuperAdmin;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2">
        <Shield size={15} className="text-primary-600" />
        조직 관리 권한
      </div>
      <p className="text-xs text-text-muted mb-2">
        {user.name ?? user.login_id}
        {currentLabel ? (
          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-medium">
            {currentLabel}
          </span>
        ) : (
          <span className="ml-2 text-slate-500">일반 구성원</span>
        )}
        {(user as SiteUserRow & { is_company_founder?: boolean }).is_company_founder && (
          <span className="ml-1 text-[10px] text-amber-700">· 창립 사내관리자</span>
        )}
      </p>

      {showPlatform && (
        <div className="mb-2">
          <p className="text-[10px] font-medium text-slate-500 mb-1">플랫폼(전체)</p>
          <div className="flex flex-wrap gap-1">
            {PLATFORM_ROLES.map((r) => (
              <Button
                key={r.id}
                size="xs"
                variant={user.permission_role_id === r.id ? "primary" : "outline"}
                onClick={() => assign(r.id)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {showCompany && (
        <div>
          <p className="text-[10px] font-medium text-slate-500 mb-1">회사(관리번호 {user.management_number})</p>
          <div className="flex flex-wrap gap-1">
            {COMPANY_ROLES.map((r) => (
              <Button
                key={r.id}
                size="xs"
                variant={user.permission_role_id === r.id ? "primary" : "outline"}
                onClick={() => assign(r.id)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!showPlatform && !showCompany && (
        <p className="text-xs text-text-muted">관리 권한 지정은 사내관리자 이상만 가능합니다.</p>
      )}
    </div>
  );
}
