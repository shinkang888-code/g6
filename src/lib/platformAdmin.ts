/**
 * 플랫폼(전체 회사) 관리 권한 — 관리번호 00000 마스터 테넌트 등
 */

import type { SessionPayload } from "@/lib/authSession";
import {
  canManageCompanyWorkspace,
  canManagePlatformRegistry,
  isPlatformSuperAdmin,
} from "@/lib/adminRoles";
import { hasAdminAccess } from "@/lib/adminSession";

export { isPlatformSuperAdmin, isPlatformDeputy, isAnyPlatformStaff } from "@/lib/adminRoles";

export function isAdminRole(session: SessionPayload): boolean {
  return hasAdminAccess(session);
}

/** @deprecated isPlatformSuperAdmin 사용 권장 */
export function isPlatformAdmin(session: SessionPayload): boolean {
  return isPlatformSuperAdmin(session);
}

/** 특정 관리번호 데이터 접근 (플랫폼 관리자 또는 해당 회사 사내관리자) */
export function canManageCompany(session: SessionPayload, managementNumber: string): boolean {
  return canManageCompanyWorkspace(session, managementNumber);
}

/** 신규 관리번호 등록·삭제·관리번호 변경 */
export function canCreateOrDeleteCompany(session: SessionPayload): boolean {
  return canManagePlatformRegistry(session);
}
