/**
 * fireauto 8카테고리 보안 감사 실행
 * POST — 전체 스캔 후 DB 저장
 */

import { NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { runSecurityAudit, saveAuditRun } from "@/lib/security/securityAuditRunner";

export async function POST() {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  try {
    const report = await runSecurityAudit();
    const runId = await saveAuditRun(auth.session.loginId ?? "admin", report);

    return NextResponse.json({
      ok: true,
      runId,
      report,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "감사 실행 실패" },
      { status: 500 }
    );
  }
}
