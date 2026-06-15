import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { canManageCompanyWorkspace } from "@/lib/adminRoles";
import { appBaseUrl, getSubscriptionPlan, stripePriceIdMonthly } from "@/lib/subscription/subscriptionConfig";
import { ensureTenantSubscription } from "@/lib/subscription/subscriptionService";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { requireTenantSession } from "@/lib/tenantScope";

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession({ pathname: request.nextUrl.pathname });
  if ("error" in auth) return auth.error;
  const { db, session, managementNumber } = auth;

  if (!canManageCompanyWorkspace(session, managementNumber)) {
    return NextResponse.json({ error: "사내관리자만 결제를 진행할 수 있습니다." }, { status: 403 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe가 설정되지 않았습니다. STRIPE_SECRET_KEY를 환경 변수에 추가하세요." },
      { status: 503 }
    );
  }

  const priceId = stripePriceIdMonthly();
  const plan = getSubscriptionPlan();
  const sub = await ensureTenantSubscription(db, managementNumber);
  const base = appBaseUrl();

  let customerId = sub.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.loginId.includes("@") ? session.loginId : undefined,
      name: session.name,
      metadata: { management_number: managementNumber, login_id: session.loginId },
    });
    customerId = customer.id;
    await db
      .from("tenant_subscriptions")
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq("management_number", managementNumber);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          price_data: {
            currency: "krw",
            product_data: { name: plan.name },
            unit_amount: plan.amountKrw,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ];

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    success_url: `${base}/admin/settings/billing?stripe=success`,
    cancel_url: `${base}/admin/settings/billing?stripe=cancel`,
    metadata: { management_number: managementNumber },
    subscription_data: {
      metadata: { management_number: managementNumber },
    },
  });

  return NextResponse.json({ url: checkout.url, sessionId: checkout.id });
}
