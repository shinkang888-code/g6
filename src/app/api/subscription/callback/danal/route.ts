import { NextRequest, NextResponse } from "next/server";
import { verifyDanalCallback } from "@/lib/danal/danalClient";
import { appBaseUrl } from "@/lib/subscription/subscriptionConfig";
import {
  activateSubscriptionPeriod,
  logSubscriptionEvent,
} from "@/lib/subscription/subscriptionService";
import { enforceSubscriptionSideEffects } from "@/lib/subscription/subscriptionGate";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function collectFormPayload(request: NextRequest, bodyText: string): Record<string, string> {
  const out: Record<string, string> = {};
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    for (const [k, v] of new URLSearchParams(bodyText)) out[k] = v;
  } else {
    try {
      const json = JSON.parse(bodyText) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) out[k] = String(v ?? "");
    } catch {
      for (const [k, v] of new URLSearchParams(bodyText)) out[k] = v;
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const bodyText = await request.text();
  const payload = collectFormPayload(request, bodyText);
  const verified = verifyDanalCallback(payload);

  const base = appBaseUrl();
  const redirect = (ok: boolean) =>
    NextResponse.redirect(`${base}/admin/settings/billing?danal=${ok ? "success" : "fail"}`);

  if (!verified.ok || !verified.managementNumber) {
    await logSubscriptionEvent(db, {
      managementNumber: verified.managementNumber ?? "unknown",
      provider: "danal",
      eventType: "callback_failed",
      raw: payload,
    });
    return redirect(false);
  }

  try {
    await activateSubscriptionPeriod(db, verified.managementNumber, {
      provider: "danal",
      amountKrw: verified.amount,
      externalId: verified.orderId,
      danalUserId: verified.managementNumber,
      danalBillKey: payload.BILLKEY ?? payload.billkey,
    });
    await logSubscriptionEvent(db, {
      managementNumber: verified.managementNumber,
      provider: "danal",
      eventType: "callback_success",
      amount: verified.amount,
      externalId: verified.orderId,
      raw: payload,
    });
    await enforceSubscriptionSideEffects(db, verified.managementNumber);
    return redirect(true);
  } catch (e) {
    await logSubscriptionEvent(db, {
      managementNumber: verified.managementNumber,
      provider: "danal",
      eventType: "callback_error",
      raw: { error: e instanceof Error ? e.message : "unknown", payload },
    });
    return redirect(false);
  }
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const fakeReq = new NextRequest(request.url, { method: "POST", body: new URLSearchParams(params).toString() });
  return POST(fakeReq);
}
