/**
 * fireauto 감사 이력 목록 / 상세
 * GET ?id= — 상세, 없으면 목록
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSecretsAdmin } from "@/lib/adminSession";
import { getAuditRun, listAuditRuns } from "@/lib/security/securityAuditRunner";

export async function GET(request: NextRequest) {
  const auth = await requirePlatformSecretsAdmin();
  if ("error" in auth) return auth.error;

  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const run = await getAuditRun(id);
    if (!run) return NextResponse.json({ error: "이력 없음" }, { status: 404 });
    return NextResponse.json(run);
  }

  const runs = await listAuditRuns(20);
  return NextResponse.json({ data: runs });
}
