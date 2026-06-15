/**
 * 사건 엑셀 import 미리보기 (LawTop ImportRow 패턴)
 * POST { items: CaseExcelRow[] } — DB 중복·배치 중복 분류만 수행, 저장하지 않음
 */

import { NextRequest, NextResponse } from "next/server";
import { loadExistingCaseKeySets, planCaseImport } from "@/lib/caseImportServer";
import { requireTenantSession } from "@/lib/tenantScope";
import { getClientIdentifier, LIMIT_IMPORT_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `import:cases-preview:${getClientIdentifier(request)}`,
    LIMIT_IMPORT_PER_MIN,
    { routePath: "/api/admin/cases/import-preview", source: "upload" }
  );
  if (limited) return limited;

  const auth = await requireTenantSession({ pathname: "/api/admin/cases/import-preview" });
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: { items?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ success: false, error: "미리볼 사건 데이터가 없습니다." }, { status: 400 });
  }

  try {
    const existing = await loadExistingCaseKeySets(db, managementNumber);
    const plan = planCaseImport(items, existing, managementNumber);
    return NextResponse.json({
      success: true,
      rows: plan.rows,
      itemsToInsert: plan.rows.filter((r) => r.status === "insert").map((r) => r.item),
      summary: plan.summary,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "미리보기 실패" },
      { status: 500 }
    );
  }
}
