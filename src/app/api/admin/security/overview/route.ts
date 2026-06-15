/**
 * LSCC ??? ?? ? ?? ?? + ?? ?? ??
 * GET /api/admin/security/overview
 */

import { NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { getSecuritySummary } from "@/lib/security/securityEventCollector";
import { buildSecurityConsoleStatus } from "@/lib/security/securityModulesCatalog";

export async function GET() {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  const status = buildSecurityConsoleStatus(!!db);
  const summary = await getSecuritySummary();

  return NextResponse.json({
    ...status,
    summary,
    viewer: {
      loginId: auth.session.loginId,
      name: auth.session.name,
      role: auth.session.role,
    },
  });
}
