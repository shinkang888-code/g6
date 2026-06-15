/**
 * 현재 세션 조회 (로그인 여부)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authSession";
import { getClientIdentifier, LIMIT_AUTH_READ_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";
import {
  isAnyPlatformStaff,
  isCompanyAdmin,
  isCompanySuperAdmin,
  isPlatformDeputy,
  isPlatformSuperAdmin,
  sessionAdminRoleLabel,
} from "@/lib/adminRoles";
import { isTrialManagementNumber } from "@/lib/trialTenant";
import { isPlatformSecretsAdmin } from "@/lib/platformSecretsAdmin";
import { ensureTenantSubscription } from "@/lib/subscription/subscriptionService";
import { assertTenantSubscriptionAccess } from "@/lib/subscription/subscriptionGate";
import { toSubscriptionPublicView } from "@/lib/subscription/subscriptionView";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import {
  resolveActiveManagementNumber,
  resolveHomeManagementNumber,
} from "@/lib/platformTenantSwitch";

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `auth:session:${getClientIdentifier(request)}`,
    LIMIT_AUTH_READ_PER_MIN,
    { routePath: "/api/auth/session", source: "auth" }
  );
  if (limited) return limited;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  let subscription: ReturnType<typeof toSubscriptionPublicView> | null = null;
  let subscriptionAccess: Awaited<ReturnType<typeof assertTenantSubscriptionAccess>> | null = null;
  const db = getSupabaseAdmin();
  const mn = resolveActiveManagementNumber(session);
  const homeMn = resolveHomeManagementNumber(session);
  if (db && mn) {
    try {
      const sub = await ensureTenantSubscription(db, mn);
      subscription = toSubscriptionPublicView(sub, session);
      subscriptionAccess = await assertTenantSubscriptionAccess(db, session, mn, "/api/auth/session");
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json(
    {
      user: {
        ...session,
        managementNumber: mn || session.managementNumber,
        homeManagementNumber: homeMn || session.homeManagementNumber,
        activeManagementNumber: mn || session.activeManagementNumber,
        adminRoleLabel: sessionAdminRoleLabel(session),
        isPlatformSuperAdmin: isPlatformSuperAdmin(session),
        isPlatformDeputy: isPlatformDeputy(session),
        isAnyPlatformStaff: isAnyPlatformStaff(session),
        isCompanySuperAdmin: isCompanySuperAdmin(session),
        isCompanyAdmin: isCompanyAdmin(session),
        canManagePlatformSecrets: isPlatformSecretsAdmin(session),
        isTrialTenant: isTrialManagementNumber(session.managementNumber),
        subscription,
        subscriptionAccess,
      },
    },
    { status: 200 }
  );
}
