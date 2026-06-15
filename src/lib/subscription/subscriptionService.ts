import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSubscriptionPlan,
  isSubscriptionExemptManagementNumber,
  subscriptionGraceDays,
} from "@/lib/subscription/subscriptionConfig";
import type {
  SubscriptionAccessResult,
  SubscriptionStatus,
  TenantSubscriptionRow,
} from "@/lib/subscription/subscriptionTypes";

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function rowFromDb(r: Record<string, unknown>): TenantSubscriptionRow {
  return {
    management_number: String(r.management_number),
    status: String(r.status) as SubscriptionStatus,
    plan_id: String(r.plan_id ?? "standard_monthly"),
    billing_provider: (r.billing_provider as TenantSubscriptionRow["billing_provider"]) ?? null,
    stripe_customer_id: (r.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id: (r.stripe_subscription_id as string | null) ?? null,
    danal_user_id: (r.danal_user_id as string | null) ?? null,
    danal_bill_key: (r.danal_bill_key as string | null) ?? null,
    current_period_start: (r.current_period_start as string | null) ?? null,
    current_period_end: (r.current_period_end as string | null) ?? null,
    grace_until: (r.grace_until as string | null) ?? null,
    trial_ends_at: (r.trial_ends_at as string | null) ?? null,
    suspended_at: (r.suspended_at as string | null) ?? null,
    cancelled_at: (r.cancelled_at as string | null) ?? null,
    seat_limit: Number(r.seat_limit ?? 50),
    last_payment_at: (r.last_payment_at as string | null) ?? null,
    last_payment_amount: r.last_payment_amount != null ? Number(r.last_payment_amount) : null,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function getTenantSubscription(
  db: SupabaseClient,
  managementNumber: string
): Promise<TenantSubscriptionRow | null> {
  const { data } = await db
    .from("tenant_subscriptions")
    .select("*")
    .eq("management_number", managementNumber)
    .maybeSingle();
  return data ? rowFromDb(data as Record<string, unknown>) : null;
}

export async function ensureTenantSubscription(
  db: SupabaseClient,
  managementNumber: string
): Promise<TenantSubscriptionRow> {
  const existing = await getTenantSubscription(db, managementNumber);
  if (existing) return existing;

  const plan = getSubscriptionPlan();
  const now = new Date();
  const exempt = isSubscriptionExemptManagementNumber(managementNumber);
  const trialEnd = exempt ? null : addDays(now, plan.trialDays);
  const periodEnd = exempt ? addMonths(now, 120) : trialEnd;

  const row = {
    management_number: managementNumber,
    status: exempt ? "active" : "trialing",
    plan_id: plan.id,
    billing_provider: exempt ? "manual" : null,
    trial_ends_at: trialEnd?.toISOString() ?? null,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd?.toISOString() ?? null,
    seat_limit: plan.seatLimit,
    updated_at: now.toISOString(),
  };

  const { data, error } = await db
    .from("tenant_subscriptions")
    .upsert(row, { onConflict: "management_number" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "구독 레코드 생성 실패");
  }
  return rowFromDb(data as Record<string, unknown>);
}

export function evaluateSubscriptionAccess(
  sub: TenantSubscriptionRow | null,
  managementNumber: string,
  opts?: { allowBillingPaths?: boolean }
): SubscriptionAccessResult {
  if (isSubscriptionExemptManagementNumber(managementNumber)) {
    return { allowed: true, status: "active" };
  }

  if (!sub) {
    return {
      allowed: false,
      status: "suspended",
      code: "SUBSCRIPTION_MISSING",
      reason: "구독 정보가 없습니다. 사내관리자에게 문의하세요.",
      billingRequired: true,
    };
  }

  const now = Date.now();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const graceUntil = sub.grace_until ? new Date(sub.grace_until).getTime() : null;
  const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null;

  if (sub.status === "active" || sub.status === "trialing") {
    if (sub.status === "trialing" && trialEnd && now > trialEnd) {
      return {
        allowed: opts?.allowBillingPaths ?? false,
        status: "past_due",
        code: "TRIAL_EXPIRED",
        reason: "체험 기간이 종료되었습니다. 사내관리자가 구독 결제를 진행해 주세요.",
        billingRequired: true,
        currentPeriodEnd: sub.current_period_end,
      };
    }
    if (periodEnd && now > periodEnd) {
      return {
        allowed: opts?.allowBillingPaths ?? false,
        status: "past_due",
        code: "PERIOD_EXPIRED",
        reason: "구독 기간이 만료되었습니다. 결제 후 이용을 재개할 수 있습니다.",
        billingRequired: true,
        currentPeriodEnd: sub.current_period_end,
      };
    }
    return { allowed: true, status: sub.status, currentPeriodEnd: sub.current_period_end };
  }

  if (sub.status === "past_due") {
    const inGrace = graceUntil && now <= graceUntil;
    if (inGrace) {
      return {
        allowed: true,
        status: "past_due",
        graceUntil: sub.grace_until,
        currentPeriodEnd: sub.current_period_end,
        reason: "결제 유예 기간입니다. 사내관리자가 결제를 완료해 주세요.",
      };
    }
    return {
      allowed: opts?.allowBillingPaths ?? false,
      status: "past_due",
      code: "PAYMENT_OVERDUE",
      reason: "결제가 완료되지 않아 이용이 제한되었습니다.",
      billingRequired: true,
      graceUntil: sub.grace_until,
      currentPeriodEnd: sub.current_period_end,
    };
  }

  if (sub.status === "suspended" || sub.status === "cancelled") {
    return {
      allowed: opts?.allowBillingPaths ?? false,
      status: sub.status,
      code: sub.status === "suspended" ? "SUBSCRIPTION_SUSPENDED" : "SUBSCRIPTION_CANCELLED",
      reason:
        sub.status === "suspended"
          ? "구독이 정지되었습니다. 사내관리자가 결제·재활성화를 진행해 주세요."
          : "구독이 해지되었습니다. 재구독 후 이용할 수 있습니다.",
      billingRequired: true,
      currentPeriodEnd: sub.current_period_end,
    };
  }

  return { allowed: true, status: sub.status };
}

export async function activateSubscriptionPeriod(
  db: SupabaseClient,
  managementNumber: string,
  opts: {
    provider: "stripe" | "danal" | "manual";
    amountKrw?: number;
    externalId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    danalUserId?: string;
    danalBillKey?: string;
    months?: number;
  }
): Promise<TenantSubscriptionRow> {
  const now = new Date();
  const months = opts.months ?? 1;
  const periodEnd = addMonths(now, months);

  const patch: Record<string, unknown> = {
    status: "active",
    billing_provider: opts.provider,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    grace_until: null,
    suspended_at: null,
    cancelled_at: null,
    trial_ends_at: null,
    last_payment_at: now.toISOString(),
    last_payment_amount: opts.amountKrw ?? getSubscriptionPlan().amountKrw,
    updated_at: now.toISOString(),
  };

  if (opts.stripeCustomerId) patch.stripe_customer_id = opts.stripeCustomerId;
  if (opts.stripeSubscriptionId) patch.stripe_subscription_id = opts.stripeSubscriptionId;
  if (opts.danalUserId) patch.danal_user_id = opts.danalUserId;
  if (opts.danalBillKey) patch.danal_bill_key = opts.danalBillKey;

  const { data, error } = await db
    .from("tenant_subscriptions")
    .update(patch)
    .eq("management_number", managementNumber)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "구독 활성화 실패");

  await db.from("subscription_payment_events").insert({
    management_number: managementNumber,
    provider: opts.provider,
    event_type: "payment_succeeded",
    amount: opts.amountKrw ?? getSubscriptionPlan().amountKrw,
    currency: "krw",
    external_id: opts.externalId ?? null,
    payload: { months },
  });

  return rowFromDb(data as Record<string, unknown>);
}

export async function markSubscriptionPastDue(
  db: SupabaseClient,
  managementNumber: string
): Promise<void> {
  const grace = addDays(new Date(), subscriptionGraceDays());
  await db
    .from("tenant_subscriptions")
    .update({
      status: "past_due",
      grace_until: grace.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("management_number", managementNumber);
}

export async function suspendTenantSubscription(
  db: SupabaseClient,
  managementNumber: string,
  reason?: string
): Promise<void> {
  await db
    .from("tenant_subscriptions")
    .update({
      status: "suspended",
      suspended_at: new Date().toISOString(),
      metadata: { suspend_reason: reason ?? "manual" },
      updated_at: new Date().toISOString(),
    })
    .eq("management_number", managementNumber);
}

export async function reactivateTenantSubscription(
  db: SupabaseClient,
  managementNumber: string
): Promise<void> {
  const now = new Date();
  const periodEnd = addMonths(now, 1);
  await db
    .from("tenant_subscriptions")
    .update({
      status: "active",
      suspended_at: null,
      cancelled_at: null,
      grace_until: null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("management_number", managementNumber);
}

export async function logSubscriptionEvent(
  db: SupabaseClient,
  payload: {
    managementNumber: string;
    provider: string;
    eventType: string;
    amount?: number;
    externalId?: string;
    raw?: unknown;
  }
): Promise<void> {
  await db.from("subscription_payment_events").insert({
    management_number: payload.managementNumber,
    provider: payload.provider,
    event_type: payload.eventType,
    amount: payload.amount ?? null,
    currency: "krw",
    external_id: payload.externalId ?? null,
    payload: payload.raw ?? null,
  });
}

export async function expireOverdueSubscriptions(db: SupabaseClient): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await db
    .from("tenant_subscriptions")
    .select("management_number, status, current_period_end, grace_until, trial_ends_at")
    .in("status", ["trialing", "active", "past_due"]);

  let updated = 0;
  for (const row of rows ?? []) {
    const mn = String(row.management_number);
    if (isSubscriptionExemptManagementNumber(mn)) continue;

    const now = Date.now();
    const periodEnd = row.current_period_end ? new Date(String(row.current_period_end)).getTime() : null;
    const graceUntil = row.grace_until ? new Date(String(row.grace_until)).getTime() : null;
    const trialEnd = row.trial_ends_at ? new Date(String(row.trial_ends_at)).getTime() : null;
    const status = String(row.status);

    let shouldSuspend = false;

    if (status === "trialing" && trialEnd && now > trialEnd) shouldSuspend = true;
    if ((status === "active" || status === "trialing") && periodEnd && now > periodEnd) {
      await markSubscriptionPastDue(db, mn);
      updated += 1;
      continue;
    }
    if (status === "past_due" && graceUntil && now > graceUntil) shouldSuspend = true;
    if (status === "past_due" && !graceUntil && periodEnd && now > periodEnd) shouldSuspend = true;

    if (shouldSuspend) {
      await suspendTenantSubscription(db, mn, "auto_expired");
      updated += 1;
    }
  }

  return updated;
}
