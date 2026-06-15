/**
 * 보안 이벤트 상태 변경 (MONITORED → RESOLVED 등)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { updateSecurityEventStatus } from "@/lib/security/securityEventCollector";
import type { SecurityEventStatus } from "@/lib/security/securityEventTypes";

const ALLOWED: SecurityEventStatus[] = ["MONITORED", "WARNING", "BLOCKED", "RESOLVED"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const status = body.status as SecurityEventStatus;
  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "유효하지 않은 status" }, { status: 400 });
  }

  const ok = await updateSecurityEventStatus(id, status);
  if (!ok) {
    return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, status });
}
