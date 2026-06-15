/**
 * ?? ??? ?? (Enterprise_Log_Monitoring DashboardController.getAllLogs)
 * GET ?page=&page_size=&severity=&status=&attackType=&from=&to=
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { listSecurityEvents } from "@/lib/security/securityEventCollector";

export async function GET(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  try {
    const result = await listSecurityEvents({
      page: Number(sp.get("page") ?? "1"),
      pageSize: Number(sp.get("page_size") ?? sp.get("pageSize") ?? "30"),
      severity: sp.get("severity") ?? undefined,
      status: sp.get("status") ?? undefined,
      attackType: sp.get("attackType") ?? sp.get("attack_type") ?? undefined,
      source: sp.get("source") ?? undefined,
      ip: sp.get("ip") ?? undefined,
      routePath: sp.get("routePath") ?? sp.get("route_path") ?? undefined,
      actorLoginId: sp.get("actorLoginId") ?? sp.get("actor_login_id") ?? undefined,
      search: sp.get("search") ?? sp.get("q") ?? undefined,
      unresolved: sp.get("unresolved") === "1" || sp.get("unresolved") === "true",
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "?? ??" },
      { status: 400 }
    );
  }
}
