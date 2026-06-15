export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

export type BillingProvider = "stripe" | "danal" | "manual" | null;

export type TenantSubscriptionRow = {
  management_number: string;
  status: SubscriptionStatus;
  plan_id: string;
  billing_provider: BillingProvider;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  danal_user_id: string | null;
  danal_bill_key: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  trial_ends_at: string | null;
  suspended_at: string | null;
  cancelled_at: string | null;
  seat_limit: number;
  last_payment_at: string | null;
  last_payment_amount: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionAccessResult = {
  allowed: boolean;
  status: SubscriptionStatus;
  reason?: string;
  code?: string;
  graceUntil?: string | null;
  currentPeriodEnd?: string | null;
  billingRequired?: boolean;
};

export type SubscriptionPublicView = {
  managementNumber: string;
  status: SubscriptionStatus;
  planId: string;
  planName: string;
  planAmountKrw: number;
  billingProvider: BillingProvider;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  graceUntil: string | null;
  seatLimit: number;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
  stripeConfigured: boolean;
  danalConfigured: boolean;
  canManageBilling: boolean;
};
