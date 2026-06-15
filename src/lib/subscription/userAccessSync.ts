import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANY_ADMIN_ROLE_ID, COMPANY_CO_ADMIN_ROLE_ID } from "@/lib/adminRoles";
import { ADMIN_ROLE_ID } from "@/lib/rolesSchema";
import type { SubscriptionAccessResult } from "@/lib/subscription/subscriptionTypes";

const ADMIN_ROLE_IDS = new Set([
  COMPANY_ADMIN_ROLE_ID,
  COMPANY_CO_ADMIN_ROLE_ID,
  ADMIN_ROLE_ID,
]);

/** 구독 정지 시 일반 직원 로그인 차단용 상태 */
export const SUBSCRIPTION_HOLD_STATUS = "subscription_hold";

export async function syncTenantUserAccessForSubscription(
  db: SupabaseClient,
  managementNumber: string,
  access: SubscriptionAccessResult
): Promise<{ suspended: number; restored: number }> {
  const shouldSuspendUsers =
    !access.allowed &&
    (access.status === "suspended" ||
      access.status === "cancelled" ||
      access.code === "PAYMENT_OVERDUE" ||
      access.code === "TRIAL_EXPIRED" ||
      access.code === "PERIOD_EXPIRED");

  if (shouldSuspendUsers) {
    const { data: users } = await db
      .from("site_users")
      .select("id, status, permission_role_id, role")
      .eq("management_number", managementNumber)
      .in("status", ["active", "approved"]);

    let suspended = 0;
    for (const u of users ?? []) {
      const rid = String(u.permission_role_id ?? "");
      const role = String(u.role ?? "");
      if (ADMIN_ROLE_IDS.has(rid) || role === "관리자") continue;
      const { error } = await db
        .from("site_users")
        .update({ status: SUBSCRIPTION_HOLD_STATUS })
        .eq("id", u.id);
      if (!error) suspended += 1;
    }
    return { suspended, restored: 0 };
  }

  if (access.allowed) {
    const { data: held } = await db
      .from("site_users")
      .select("id")
      .eq("management_number", managementNumber)
      .eq("status", SUBSCRIPTION_HOLD_STATUS);

    let restored = 0;
    for (const u of held ?? []) {
      const { error } = await db
        .from("site_users")
        .update({ status: "active" })
        .eq("id", u.id);
      if (!error) restored += 1;
    }
    return { suspended: 0, restored };
  }

  return { suspended: 0, restored: 0 };
}

export function isSubscriptionHoldStatus(status: string | null | undefined): boolean {
  return status === SUBSCRIPTION_HOLD_STATUS;
}
