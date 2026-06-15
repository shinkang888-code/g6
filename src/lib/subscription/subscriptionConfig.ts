export const SUBSCRIPTION_PLANS = {
  standard_monthly: {
    id: "standard_monthly",
    name: "LawyGo 표준 (월간)",
    amountKrw: Number(process.env.SUBSCRIPTION_MONTHLY_PRICE_KRW ?? "99000"),
    interval: "month" as const,
    trialDays: Number(process.env.SUBSCRIPTION_TRIAL_DAYS ?? "14"),
    seatLimit: Number(process.env.SUBSCRIPTION_SEAT_LIMIT ?? "50"),
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

export function getSubscriptionPlan(planId?: string | null) {
  const id = (planId?.trim() || "standard_monthly") as SubscriptionPlanId;
  return SUBSCRIPTION_PLANS[id] ?? SUBSCRIPTION_PLANS.standard_monthly;
}

export function subscriptionExemptManagementNumbers(): string[] {
  return (process.env.SUBSCRIPTION_EXEMPT_MANAGEMENT_NUMBERS ?? "00000,10000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isSubscriptionExemptManagementNumber(managementNumber: string): boolean {
  return subscriptionExemptManagementNumbers().includes(managementNumber.trim());
}

export function subscriptionGraceDays(): number {
  return Number(process.env.SUBSCRIPTION_GRACE_DAYS ?? "3");
}

export function stripePriceIdMonthly(): string {
  return (process.env.STRIPE_PRICE_ID_MONTHLY ?? "").trim();
}

export function stripeWebhookSecret(): string {
  return (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
}

export function danalConfigured(): boolean {
  return Boolean(
    (process.env.DANAL_CPID ?? "").trim() &&
      (process.env.DANAL_CPPWD ?? "").trim()
  );
}

export function stripeConfigured(): boolean {
  return Boolean((process.env.STRIPE_SECRET_KEY ?? "").trim());
}

export function appBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  if (!fromEnv) return "http://localhost:3000";
  return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
}
