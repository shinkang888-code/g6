/**
 * 회사 자료실 — 파일 목록·폴더 정보
 * GET ?q=검색어
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { listCompanyFiles } from "@/lib/driveCompanyFiles";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const result = await listCompanyFiles(auth.db, auth.managementNumber, q);

  return NextResponse.json(result);
}
