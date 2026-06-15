import { NextRequest, NextResponse } from "next/server";
import { isPlatformSuperAdmin } from "@/lib/adminRoles";
import { requireAdminSession } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import {
  ensureTenantSubscription,
  reactivateTenantSubscription,
  suspendTenantSubscription,
} from "@/lib/subscription/subscriptionService";
import { enforceSubscriptionSideEffects } from "@/lib/subscription/subscriptionGate";
import { toSubscriptionPublicView } from "@/lib/subscription/subscriptionView";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ mn: string }> }
) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;
  if (!isPlatformSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "전체관리자만 조회할 수 있습니다." }, { status: 403 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const { mn } = await context.params;
  const managementNumber = mn?.trim();
  if (!managementNumber) {
    return NextResponse.json({ error: "관리번호가 필요합니다." }, { status: 400 });
  }

  const sub = await ensureTenantSubscription(db, managementNumber);
  return NextResponse.json({ subscription: toSubscriptionPublicView(sub, auth.session) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ mn: string }> }
) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;
  if (!isPlatformSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "전체관리자만 변경할 수 있습니다." }, { status: 403 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 미연결" }, { status: 503 });

  const { mn } = await context.params;
  const managementNumber = mn?.trim();
  if (!managementNumber) {
    return NextResponse.json({ error: "관리번호가 필요합니다." }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  if (body.action === "suspend") {
    await suspendTenantSubscription(db, managementNumber, "platform_admin");
    await enforceSubscriptionSideEffects(db, managementNumber);
    return NextResponse.json({ ok: true, status: "suspended" });
  }

  if (body.action === "reactivate") {
    await reactivateTenantSubscription(db, managementNumber);
    await enforceSubscriptionSideEffects(db, managementNumber);
    return NextResponse.json({ ok: true, status: "active" });
  }

  return NextResponse.json({ error: "지원하지 않는 action" }, { status: 400 });
}
