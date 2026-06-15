import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/authSession";
import { isAnyPlatformStaff, isCompanyAdmin } from "@/lib/adminRoles";
import { isSubscriptionExemptManagementNumber } from "@/lib/subscription/subscriptionConfig";
import {
  ensureTenantSubscription,
  evaluateSubscriptionAccess,
  getTenantSubscription,
} from "@/lib/subscription/subscriptionService";
import type { SubscriptionAccessResult } from "@/lib/subscription/subscriptionTypes";
import { syncTenantUserAccessForSubscription } from "@/lib/subscription/userAccessSync";

const BILLING_PATH_PREFIXES = [
  "/api/subscription",
  "/api/auth",
  "/api/admin/subscription",
  "/api/cron/subscription",
];

export function isBillingExemptPath(pathname: string): boolean {
  return BILLING_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export function canLoginDespiteSubscriptionBlock(session: {
  permissionRoleId?: string | null;
  role?: string | null;
}): boolean {
  return isCompanyAdmin(session as SessionPayload) || session.role === "관리자";
}

export async function assertTenantSubscriptionAccess(
  db: SupabaseClient,
  session: SessionPayload,
  managementNumber: string,
  pathname?: string
): Promise<SubscriptionAccessResult> {
  if (isAnyPlatformStaff(session)) return { allowed: true, status: "active" };
  if (isSubscriptionExemptManagementNumber(managementNumber)) {
    return { allowed: true, status: "active" };
  }

  const allowBilling = pathname ? isBillingExemptPath(pathname) : false;
  const sub = await ensureTenantSubscription(db, managementNumber);
  const access = evaluateSubscriptionAccess(sub, managementNumber, {
    allowBillingPaths: allowBilling,
  });

  if (!access.allowed && allowBilling && canLoginDespiteSubscriptionBlock(session)) {
    return { ...access, allowed: true };
  }

  return access;
}

export async function enforceSubscriptionSideEffects(
  db: SupabaseClient,
  managementNumber: string
): Promise<void> {
  if (isSubscriptionExemptManagementNumber(managementNumber)) return;
  const sub = await getTenantSubscription(db, managementNumber);
  if (!sub) return;
  const access = evaluateSubscriptionAccess(sub, managementNumber);
  await syncTenantUserAccessForSubscription(db, managementNumber, access);
}
