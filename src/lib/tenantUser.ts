/**
 * 관리번호(테넌트)별 사용자 집계·사내관리자 부여
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPANY_ADMIN_ROLE_ID,
  COMPANY_CO_ADMIN_ROLE_ID,
} from "@/lib/adminRoles";

export async function countUsersInTenant(
  db: SupabaseClient,
  managementNumber: string,
  options?: { activeOnly?: boolean }
): Promise<number> {
  let query = db
    .from("site_users")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber.trim());

  if (options?.activeOnly) {
    query = query.in("status", ["active", "approved"]);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function isFirstUserInTenant(
  db: SupabaseClient,
  managementNumber: string
): Promise<boolean> {
  const total = await countUsersInTenant(db, managementNumber);
  return total === 0;
}

export async function hasActiveCompanyAdmin(
  db: SupabaseClient,
  managementNumber: string
): Promise<boolean> {
  const { count, error } = await db
    .from("site_users")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber.trim())
    .in("status", ["active", "approved"])
    .in("permission_role_id", [COMPANY_ADMIN_ROLE_ID, "admin"]);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/** 관리번호별 첫 가입자 → 사내관리자 필드 */
export function companyFounderFields(now = new Date().toISOString()) {
  return {
    status: "active" as const,
    role: "관리자",
    permission_role_id: COMPANY_ADMIN_ROLE_ID,
    is_company_founder: true,
    approved_at: now,
    approved_by: "tenant-first-user",
  };
}

/** 승인 시 해당 테넌트에 active 관리자가 없으면 사내관리자 부여 */
export async function resolveApprovalAdminFields(
  db: SupabaseClient,
  managementNumber: string,
  now = new Date().toISOString()
): Promise<{ role: string; permission_role_id: string; is_company_founder?: boolean }> {
  const hasAdmin = await hasActiveCompanyAdmin(db, managementNumber);
  if (hasAdmin) {
    return { role: "직원", permission_role_id: "role-staff" };
  }
  return {
    role: "관리자",
    permission_role_id: COMPANY_ADMIN_ROLE_ID,
    is_company_founder: true,
  };
}

export async function assertSameTenantUsers(
  db: SupabaseClient,
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  const { data } = await db
    .from("site_users")
    .select("id, management_number")
    .in("id", [userIdA, userIdB]);

  if (!data || data.length !== 2) return false;
  const a = data.find((r) => r.id === userIdA);
  const b = data.find((r) => r.id === userIdB);
  const mnA = (a?.management_number as string | undefined)?.trim();
  const mnB = (b?.management_number as string | undefined)?.trim();
  return Boolean(mnA && mnB && mnA === mnB);
}

export async function getUserManagementNumber(
  db: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await db
    .from("site_users")
    .select("management_number")
    .eq("id", userId)
    .maybeSingle();
  return (data?.management_number as string | undefined)?.trim() || null;
}

export async function countCompanySuperAdmins(
  db: SupabaseClient,
  managementNumber: string,
  excludeUserId?: string
): Promise<number> {
  let query = db
    .from("site_users")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber.trim())
    .in("status", ["active", "approved"])
    .in("permission_role_id", [COMPANY_ADMIN_ROLE_ID, "admin"]);

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export function isCompanyAdminRoleId(roleId?: string | null): boolean {
  const r = roleId?.trim();
  return r === COMPANY_ADMIN_ROLE_ID || r === COMPANY_CO_ADMIN_ROLE_ID || r === "admin";
}
