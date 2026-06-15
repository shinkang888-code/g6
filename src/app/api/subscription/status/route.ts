import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { ensureTenantSubscription } from "@/lib/subscription/subscriptionService";
import { assertTenantSubscriptionAccess } from "@/lib/subscription/subscriptionGate";
import {
  listRecentPaymentEvents,
  toSubscriptionPublicView,
} from "@/lib/subscription/subscriptionView";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession({ pathname: request.nextUrl.pathname });
  if ("error" in auth) return auth.error;
  const { db, session, managementNumber } = auth;

  const access = await assertTenantSubscriptionAccess(
    db,
    session,
    managementNumber,
    request.nextUrl.pathname
  );

  const sub = await ensureTenantSubscription(db, managementNumber);
  const events = await listRecentPaymentEvents(db, managementNumber);

  return NextResponse.json({
    subscription: toSubscriptionPublicView(sub, session),
    access,
    events,
  });
}
