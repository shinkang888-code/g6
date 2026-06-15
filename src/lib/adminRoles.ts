/**
 * 조직 관리 권한 계층
 * - 전체관리자(platform_admin): 모든 회사·관리번호·전체부관리자 지정
 * - 전체부관리자(platform_deputy): 전체관리자 하위 업무, 전체관리자 권한 변경 불가
 * - 사내관리자(company_admin): 관리번호별 첫 가입자, 해당 회사 업무공간 관리
 * - 공동사내관리자(company_co_admin): 사내관리자 하위, 사내관리자 권한 변경 불가
 */

import type { SessionPayload } from "@/lib/authSession";
import { ADMIN_ROLE_ID } from "@/lib/rolesSchema";

export const PLATFORM_ADMIN_ROLE_ID = "platform_admin";
export const PLATFORM_DEPUTY_ROLE_ID = "platform_deputy";
export const COMPANY_ADMIN_ROLE_ID = "company_admin";
export const COMPANY_CO_ADMIN_ROLE_ID = "company_co_admin";

export const SYSTEM_ADMIN_ROLE_IDS = [
  PLATFORM_ADMIN_ROLE_ID,
  PLATFORM_DEPUTY_ROLE_ID,
  COMPANY_ADMIN_ROLE_ID,
  COMPANY_CO_ADMIN_ROLE_ID,
  ADMIN_ROLE_ID,
] as const;

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  [PLATFORM_ADMIN_ROLE_ID]: "전체관리자",
  [PLATFORM_DEPUTY_ROLE_ID]: "전체부관리자",
  [COMPANY_ADMIN_ROLE_ID]: "사내관리자",
  [COMPANY_CO_ADMIN_ROLE_ID]: "공동사내관리자",
  [ADMIN_ROLE_ID]: "사내관리자",
};

export function getAdminRoleLabel(roleId?: string | null): string | null {
  if (!roleId?.trim()) return null;
  return ADMIN_ROLE_LABELS[roleId.trim()] ?? null;
}

export function resolveSessionAdminRoleId(session: SessionPayload): string | null {
  const rid = session.permissionRoleId?.trim();
  if (rid && SYSTEM_ADMIN_ROLE_IDS.includes(rid as (typeof SYSTEM_ADMIN_ROLE_IDS)[number])) {
    return rid;
  }
  if (session.role === "관리자" || session.menuPermissions?.includes("관리자")) {
    return ADMIN_ROLE_ID;
  }
  return null;
}

function platformSuperLoginIds(): string[] {
  return (process.env.PLATFORM_ADMIN_LOGIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function platformDeputyLoginIds(): string[] {
  return (process.env.PLATFORM_DEPUTY_LOGIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 전체관리자 — 모든 회사·관리번호·권한 위임 */
export function isPlatformSuperAdmin(session: SessionPayload): boolean {
  const rid = session.permissionRoleId?.trim();
  if (rid === PLATFORM_ADMIN_ROLE_ID) return true;
  return platformSuperLoginIds().includes(session.loginId);
}

/** 전체부관리자 — 전체관리자 하위, 전체관리자 권한 변경 불가 */
export function isPlatformDeputy(session: SessionPayload): boolean {
  if (isPlatformSuperAdmin(session)) return false;
  const rid = session.permissionRoleId?.trim();
  if (rid === PLATFORM_DEPUTY_ROLE_ID) return true;
  return platformDeputyLoginIds().includes(session.loginId);
}

/** 플랫폼(전체) 관리자 또는 부관리자 */
export function isAnyPlatformStaff(session: SessionPayload): boolean {
  return isPlatformSuperAdmin(session) || isPlatformDeputy(session);
}

/** 사내관리자(창립자) */
export function isCompanySuperAdminRole(roleId?: string | null): boolean {
  const r = roleId?.trim();
  return r === COMPANY_ADMIN_ROLE_ID || r === ADMIN_ROLE_ID;
}

/** 사내관리자 또는 공동 사내관리자 */
export function isCompanyAdminRole(roleId?: string | null): boolean {
  const r = roleId?.trim();
  return (
    r === COMPANY_ADMIN_ROLE_ID ||
    r === COMPANY_CO_ADMIN_ROLE_ID ||
    r === ADMIN_ROLE_ID
  );
}

export function isCompanySuperAdmin(session: SessionPayload): boolean {
  return isCompanySuperAdminRole(session.permissionRoleId);
}

export function isCompanyCoAdmin(session: SessionPayload): boolean {
  return session.permissionRoleId?.trim() === COMPANY_CO_ADMIN_ROLE_ID;
}

export function isCompanyAdmin(session: SessionPayload): boolean {
  return isCompanyAdminRole(session.permissionRoleId);
}

/** 회사 업무공간 관리 권한 (조직·가입승인·구성원) */
export function canManageCompanyWorkspace(
  session: SessionPayload,
  managementNumber: string
): boolean {
  if (isAnyPlatformStaff(session)) return true;
  const mn = (session.managementNumber ?? "").trim();
  if (mn !== managementNumber.trim()) return false;
  return isCompanyAdmin(session) || session.role === "관리자";
}

/** 신규 관리번호 생성·회사 삭제·관리번호 변경 */
export function canManagePlatformRegistry(session: SessionPayload): boolean {
  return isPlatformSuperAdmin(session);
}

/** 대상 역할 ID의 계층 레벨 (높을수록 상위) */
export function adminRoleLevel(roleId?: string | null): number {
  const r = roleId?.trim();
  if (r === PLATFORM_ADMIN_ROLE_ID) return 100;
  if (r === PLATFORM_DEPUTY_ROLE_ID) return 90;
  if (r === COMPANY_ADMIN_ROLE_ID || r === ADMIN_ROLE_ID) return 50;
  if (r === COMPANY_CO_ADMIN_ROLE_ID) return 40;
  return 0;
}

export function actorCanModifyTargetAdminRole(
  actor: SessionPayload,
  targetRoleId?: string | null
): boolean {
  const targetLevel = adminRoleLevel(targetRoleId);
  if (targetLevel === 0) return true;

  if (isPlatformSuperAdmin(actor)) return true;

  if (isPlatformDeputy(actor)) {
    return targetLevel < adminRoleLevel(PLATFORM_DEPUTY_ROLE_ID);
  }

  if (isCompanySuperAdmin(actor)) {
    return targetLevel <= adminRoleLevel(COMPANY_CO_ADMIN_ROLE_ID);
  }

  if (isCompanyCoAdmin(actor)) {
    return targetLevel < adminRoleLevel(COMPANY_CO_ADMIN_ROLE_ID);
  }

  return false;
}

export function actorCanAssignAdminRole(actor: SessionPayload, newRoleId: string): boolean {
  const level = adminRoleLevel(newRoleId);
  if (level === 0) return true;

  if (newRoleId === PLATFORM_ADMIN_ROLE_ID || newRoleId === PLATFORM_DEPUTY_ROLE_ID) {
    return isPlatformSuperAdmin(actor);
  }

  if (newRoleId === COMPANY_ADMIN_ROLE_ID || newRoleId === COMPANY_CO_ADMIN_ROLE_ID) {
    return isAnyPlatformStaff(actor) || isCompanySuperAdmin(actor);
  }

  return false;
}

export function sessionAdminRoleLabel(session: SessionPayload): string | null {
  if (isPlatformSuperAdmin(session)) return ADMIN_ROLE_LABELS[PLATFORM_ADMIN_ROLE_ID];
  if (isPlatformDeputy(session)) return ADMIN_ROLE_LABELS[PLATFORM_DEPUTY_ROLE_ID];
  const rid = session.permissionRoleId?.trim();
  if (rid === COMPANY_CO_ADMIN_ROLE_ID) return ADMIN_ROLE_LABELS[COMPANY_CO_ADMIN_ROLE_ID];
  if (isCompanySuperAdminRole(rid) || session.role === "관리자") {
    return ADMIN_ROLE_LABELS[COMPANY_ADMIN_ROLE_ID];
  }
  return null;
}
