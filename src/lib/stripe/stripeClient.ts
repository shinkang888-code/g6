import Stripe from "stripe";
import { stripeConfigured } from "@/lib/subscription/subscriptionConfig";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (!stripeConfigured()) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
  }
  return stripeClient;
}
