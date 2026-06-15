/**
 * ?? ??? ?? (Enterprise_Log_Monitoring countByAttackType)
 */

import { NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { getAttackTypeStats, listSecurityEvents } from "@/lib/security/securityEventCollector";

export async function GET() {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const stats = await getAttackTypeStats();
  const { total } = await listSecurityEvents({ page: 1, pageSize: 1 });

  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const db = await import("@/lib/supabaseClient").then((m) => m.getSupabaseAdmin());
  if (db) {
    const { data } = await db.from("security_events").select("severity_level");
    for (const row of (data ?? []) as { severity_level: keyof typeof severityCounts }[]) {
      if (row.severity_level in severityCounts) {
        severityCounts[row.severity_level] += 1;
      }
    }
  }

  return NextResponse.json({
    total,
    chartLabels: stats.map((s) => s.attackType),
    chartData: stats.map((s) => s.count),
    stats,
    severityCounts,
  });
}
