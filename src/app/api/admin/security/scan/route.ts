/**
 * Enterprise_Log_Monitoring POST /scan/my-pc ? ?? ?? ??
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { analyzeAndLogRequest } from "@/lib/security/securityEventCollector";

export async function POST(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const event = await analyzeAndLogRequest(request, {
    actorLoginId: auth.session.loginId,
    tenantId: auth.session.managementNumber,
    source: "scan",
  });

  return NextResponse.json({
    ok: true,
    message: "?? ?? ??? ???????.",
    event,
  });
}
