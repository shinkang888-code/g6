/**
 * 권한 관리: 역할 목록 및 상태 스키마
 * app_settings.roles, app_settings.role_permissions 에 저장
 */

export type RoleStatus = "active" | "pending_deletion";

export interface Role {
  id: string;
  name: string;
  status: RoleStatus;
  sortOrder?: number;
}

export const ADMIN_ROLE_ID = "admin";

/** 시스템 조직 관리 역할 (삭제·이름 변경 불가) */
export const SYSTEM_ROLE_IDS = [
  "platform_admin",
  "platform_deputy",
  "company_admin",
  "company_co_admin",
  ADMIN_ROLE_ID,
] as const;

export const SYSTEM_ROLE_NAMES: Record<string, string> = {
  platform_admin: "전체관리자",
  platform_deputy: "전체부관리자",
  company_admin: "사내관리자",
  company_co_admin: "공동사내관리자",
  [ADMIN_ROLE_ID]: "사내관리자(레거시)",
};

export function isSystemRoleId(roleId: string): boolean {
  return SYSTEM_ROLE_IDS.includes(roleId as (typeof SYSTEM_ROLE_IDS)[number]);
}

export const SETTINGS_KEYS = {
  roles: "roles",
  rolePermissions: "role_permissions",
} as const;

export function createRoleId(): string {
  return "role-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

export const DEFAULT_ROLE_NAMES = ["관리자", "변호사", "사무장", "사무원", "인턴"] as const;

const DEFAULT_IDS: Record<string, string> = {
  관리자: ADMIN_ROLE_ID,
  변호사: "role-lawyer",
  사무장: "role-manager",
  사무원: "role-staff",
  인턴: "role-intern",
};

export function getDefaultRoles(): Role[] {
  const systemRoles: Role[] = [
    { id: "platform_admin", name: "전체관리자", status: "active", sortOrder: -4 },
    { id: "platform_deputy", name: "전체부관리자", status: "active", sortOrder: -3 },
    { id: "company_admin", name: "사내관리자", status: "active", sortOrder: -2 },
    { id: "company_co_admin", name: "공동사내관리자", status: "active", sortOrder: -1 },
  ];
  const hrRoles = DEFAULT_ROLE_NAMES.map((name, i) => ({
    id: DEFAULT_IDS[name] ?? createRoleId(),
    name,
    status: "active" as RoleStatus,
    sortOrder: i,
  }));
  return [...systemRoles, ...hrRoles];
}
