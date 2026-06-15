import { parseStaffProfile, primaryPhoneFromStaffFields } from "@/lib/staffProfile";

import { ADMIN_ROLE_ID } from "@/lib/rolesSchema";

export type UserLifecycleStatus =
  | "pending"
  | "active"
  | "approved"
  | "on_hold"
  | "subscription_hold"
  | "rejected"
  | "resigned"
  | "excluded";

export type ResignType = "resigned" | "excluded";

export type SiteUserRow = {
  id: string;
  login_id: string;
  management_number: string | null;
  status: string;
  name: string | null;
  role: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  profile?: Record<string, unknown> | null;
  permission_role_id?: string | null;
  created_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  resigned_at?: string | null;
  resigned_by?: string | null;
  resign_reason?: string | null;
  google_email?: string | null;
  auth_provider?: string | null;
  organization_id?: string | null;
  is_company_founder?: boolean | null;
};

export const USER_STATUS_LABELS: Record<string, string> = {
  pending: "가입승인대기",
  active: "재직",
  approved: "재직",
  on_hold: "승인보류",
  subscription_hold: "구독정지",
  rejected: "가입거절",
  resigned: "퇴사",
  excluded: "제외",
};

export function isSignupReviewStatus(status: string | null | undefined): boolean {
  return status === "pending" || status === "on_hold";
}

export const ROLE_FILTER_GROUPS = [
  { id: "all", label: "전체" },
  { id: "변호사", label: "변호사" },
  { id: "사무장,국장", label: "사무장·국장" },
  { id: "직원,사무원", label: "직원·사무원" },
  { id: "인턴", label: "인턴" },
  { id: "기타", label: "기타" },
] as const;

export function isActiveUserStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "approved";
}

export function isLoginAllowedStatus(status: string | null | undefined): boolean {
  return isActiveUserStatus(status);
}

export function isInactiveUserStatus(status: string | null | undefined): boolean {
  return status === "resigned" || status === "excluded" || status === "rejected";
}

/** 퇴사·제외 — 계정 삭제 후 다른 관리번호로 재가입 가능 */
export function isRelinquishedUserStatus(status: string | null | undefined): boolean {
  return status === "resigned" || status === "excluded";
}

export const RELINQUISHED_ACCOUNT_LOGIN_MESSAGE =
  "이전 회사에서 퇴사 또는 제외 처리된 계정입니다. 새 관리번호로 다시 가입해 주세요.";

export const RELINQUISHED_ACCOUNT_SIGNUP_HINT =
  "이전 소속에서 퇴사·제외된 계정이 정리되었습니다. 새 관리번호로 가입을 진행합니다.";

/** 인사 role → 시스템 permission_role_id 기본값 */
export function defaultPermissionRoleId(role: string | null | undefined): string {
  const r = (role ?? "").trim();
  if (r === "관리자") return ADMIN_ROLE_ID;
  if (r === "변호사" || r === "임원") return "role-lawyer";
  if (r === "사무장" || r === "국장") return "role-manager";
  if (r === "인턴") return "role-intern";
  return "role-staff";
}

export function effectivePermissionRoleId(user: {
  permission_role_id?: string | null;
  role?: string | null;
}): string {
  return (user.permission_role_id?.trim() || defaultPermissionRoleId(user.role)) ?? "role-staff";
}

export function matchesRoleFilter(role: string | null | undefined, filter: string): boolean {
  if (!filter || filter === "all") return true;
  const r = (role ?? "직원").trim();
  if (filter === "기타") {
    return !["변호사", "사무장", "국장", "직원", "사무원", "인턴", "관리자", "임원"].includes(r);
  }
  const parts = filter.split(",").map((s) => s.trim());
  return parts.includes(r);
}

export function matchesUserSearch(
  user: Pick<SiteUserRow, "login_id" | "name" | "department" | "email" | "phone" | "role">,
  q: string
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    user.login_id,
    user.name,
    user.department,
    user.email,
    user.phone,
    user.role,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function userToStaffShape(u: SiteUserRow) {
  const role = u.role?.trim() || "직원";
  let level = 1;
  if (role === "임원" || role === "관리자") level = 5;
  else if (role === "변호사") level = 3;
  else if (role === "사무장" || role === "국장") level = 2;
  else if (role === "인턴") level = 0;

  const extra = parseStaffProfile(u.profile);
  const phone = primaryPhoneFromStaffFields(u.phone, extra);

  return {
    id: u.id,
    name: (u.name && u.name.trim()) || u.login_id,
    role,
    department: u.department ?? "",
    email: u.email ?? "",
    phone,
    level,
    jobTitle: extra.jobTitle,
    companyPhone: extra.companyPhone,
    personalPhone: extra.personalPhone,
    loginId: u.login_id,
    managementNumber: u.management_number ?? undefined,
  };
}
