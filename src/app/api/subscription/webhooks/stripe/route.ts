import { NextRequest, NextResponse } from "next/server";
import { stripeWebhookSecret } from "@/lib/subscription/subscriptionConfig";
import {
  activateSubscriptionPeriod,
  logSubscriptionEvent,
  markSubscriptionPastDue,
  suspendTenantSubscription,
} from "@/lib/subscription/subscriptionService";
import { enforceSubscriptionSideEffects } from "@/lib/subscription/subscriptionGate";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

async function resolveManagementNumber(
  db: ReturnType<typeof getSupabaseAdmin>,
  meta: Stripe.Metadata | null | undefined,
  customerId?: string | null
): Promise<string | null> {
  const fromMeta = meta?.management_number?.trim();
  if (fromMeta) return fromMeta;
  if (!db || !customerId) return null;
  const { data } = await db
    .from("tenant_subscriptions")
    .select("management_number")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.management_number as string | undefined)?.trim() ?? null;
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook 미설정" }, { status: 503 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "signature 없음" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "signature 검증 실패" },
      { status: 400 }
    );
  }

  const obj = event.data.object as Stripe.Checkout.Session | Stripe.Subscription | Stripe.Invoice;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = obj as Stripe.Checkout.Session;
      const mn = await resolveManagementNumber(db, session.metadata, session.customer as string);
      if (mn && session.mode === "subscription") {
        await activateSubscriptionPeriod(db, mn, {
          provider: "stripe",
          externalId: session.id,
          stripeCustomerId: session.customer as string | undefined,
          stripeSubscriptionId: session.subscription as string | undefined,
        });
        await enforceSubscriptionSideEffects(db, mn);
      }
      break;
    }
    case "invoice.paid": {
      const invoice = obj as Stripe.Invoice;
      const mn = await resolveManagementNumber(
        db,
        invoice.metadata,
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id
      );
      const subRef = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
        .subscription;
      if (mn) {
        await activateSubscriptionPeriod(db, mn, {
          provider: "stripe",
          amountKrw: invoice.amount_paid ?? undefined,
          externalId: invoice.id,
          stripeCustomerId:
            typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
          stripeSubscriptionId:
            typeof subRef === "string" ? subRef : subRef?.id,
        });
        await enforceSubscriptionSideEffects(db, mn);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = obj as Stripe.Invoice;
      const mn = await resolveManagementNumber(
        db,
        invoice.metadata,
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id
      );
      if (mn) {
        await markSubscriptionPastDue(db, mn);
        await logSubscriptionEvent(db, {
          managementNumber: mn,
          provider: "stripe",
          eventType: "payment_failed",
          externalId: invoice.id,
          raw: event,
        });
        await enforceSubscriptionSideEffects(db, mn);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = obj as Stripe.Subscription;
      const mn = await resolveManagementNumber(
        db,
        sub.metadata,
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id
      );
      if (mn) {
        await suspendTenantSubscription(db, mn, "stripe_subscription_deleted");
        await logSubscriptionEvent(db, {
          managementNumber: mn,
          provider: "stripe",
          eventType: "subscription_deleted",
          externalId: sub.id,
          raw: event,
        });
        await enforceSubscriptionSideEffects(db, mn);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
