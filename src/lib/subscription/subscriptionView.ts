import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/authSession";
import { canManageCompanyWorkspace } from "@/lib/adminRoles";
import {
  danalConfigured,
  getSubscriptionPlan,
  stripeConfigured,
} from "@/lib/subscription/subscriptionConfig";
import type { SubscriptionPublicView, TenantSubscriptionRow } from "@/lib/subscription/subscriptionTypes";

export function toSubscriptionPublicView(
  sub: TenantSubscriptionRow,
  session: SessionPayload
): SubscriptionPublicView {
  const plan = getSubscriptionPlan(sub.plan_id);
  return {
    managementNumber: sub.management_number,
    status: sub.status,
    planId: sub.plan_id,
    planName: plan.name,
    planAmountKrw: plan.amountKrw,
    billingProvider: sub.billing_provider,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd: sub.current_period_end,
    trialEndsAt: sub.trial_ends_at,
    graceUntil: sub.grace_until,
    seatLimit: sub.seat_limit,
    lastPaymentAt: sub.last_payment_at,
    lastPaymentAmount: sub.last_payment_amount,
    stripeConfigured: stripeConfigured(),
    danalConfigured: danalConfigured(),
    canManageBilling: canManageCompanyWorkspace(session, sub.management_number),
  };
}

export async function listRecentPaymentEvents(
  db: SupabaseClient,
  managementNumber: string,
  limit = 10
) {
  const { data } = await db
    .from("subscription_payment_events")
    .select("id, provider, event_type, amount, currency, external_id, created_at")
    .eq("management_number", managementNumber)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
