/**
 * 사건 담당자·관리자 접근 판별 (대시보드 기일, API 필터 등)
 */

import type { SessionPayload } from "@/lib/authSession";
import { ADMIN_ROLE_ID } from "@/lib/rolesSchema";
import { resolveManagementNumber } from "@/lib/tenantScope";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isAdminSession(session: SessionPayload | null | undefined): boolean {
  if (!session) return false;
  if ((session.role ?? "").trim() === "관리자") return true;
  if (session.permissionRoleId === ADMIN_ROLE_ID) return true;
  const perms = session.menuPermissions ?? [];
  if (perms.includes("*")) return true;
  if (perms.includes("관리자")) return true;
  return false;
}

/** 담당자명(assigned_staff_name)에 로그인 사용자 이름/아이디가 포함되는지 */
export function matchesAssignedStaffName(
  assignedStaffName: string | null | undefined,
  session: SessionPayload
): boolean {
  const assigned = (assignedStaffName ?? "").trim().toLowerCase();
  if (!assigned) return false;
  const needles = [session.name, session.loginId]
    .map((s) => (s ?? "").trim().toLowerCase())
    .filter(Boolean);
  return needles.some((q) => assigned.includes(q));
}

export function filterDeadlinesForSession<T extends { assignedStaff?: string }>(
  items: T[],
  session: SessionPayload | null | undefined
): T[] {
  if (!session) return [];
  if (isAdminSession(session)) return items;
  return items.filter((item) => matchesAssignedStaffName(item.assignedStaff, session));
}

/** 사건 row가 세션 회사(관리번호)에 속하는지 */
export function caseRowInTenant(
  row: { management_number?: string | null; managementNumber?: string | null } | null | undefined,
  managementNumber: string
): boolean {
  const mgmt = (row?.management_number ?? row?.managementNumber ?? "").trim();
  return mgmt === managementNumber.trim();
}

export async function canAccessCaseRow(
  db: SupabaseClient,
  caseId: string,
  session: SessionPayload,
  assignedStaffName?: string | null
): Promise<boolean> {
  const mgmt = await resolveManagementNumber(session, db);
  if (!mgmt) return false;

  const { data } = await db
    .from("cases")
    .select("management_number, assigned_staff_name")
    .eq("id", caseId)
    .maybeSingle();

  if (!data || !caseRowInTenant(data, mgmt)) return false;
  if (isAdminSession(session)) return true;
  return matchesAssignedStaffName(
    assignedStaffName ?? (data.assigned_staff_name as string | undefined),
    session
  );
}
