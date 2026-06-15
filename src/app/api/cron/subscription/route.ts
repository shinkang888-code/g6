export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/ledger/cronAuth";
import { expireOverdueSubscriptions } from "@/lib/subscription/subscriptionService";
import { enforceSubscriptionSideEffects } from "@/lib/subscription/subscriptionGate";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const updated = await expireOverdueSubscriptions(db);

  const { data: suspended } = await db
    .from("tenant_subscriptions")
    .select("management_number")
    .eq("status", "suspended");

  for (const row of suspended ?? []) {
    await enforceSubscriptionSideEffects(db, String(row.management_number));
  }

  return NextResponse.json({ ok: true, updated });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
