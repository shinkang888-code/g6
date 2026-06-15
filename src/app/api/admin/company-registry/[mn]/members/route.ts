/**
 * 회사 구성원 — 조직별 목록·소속 변경
 * GET ?organizationId=uuid|null|all
 * PATCH { userId, organizationId }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { assertCompanyAccess, resolveManagementNumberParam } from "@/lib/companyRegistryAuth";
import { assignMemberOrganization, listOrganizationMembers } from "@/lib/companyOrganization";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

type RouteCtx = { params: Promise<{ mn: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const mn = resolveManagementNumberParam((await ctx.params).mn);
  if (!mn) return NextResponse.json({ error: "유효하지 않은 관리번호입니다." }, { status: 400 });

  const denied = assertCompanyAccess(auth.session, mn);
  if (denied) return denied;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  const orgParam = request.nextUrl.searchParams.get("organizationId");
  let filter: { organizationId?: string | null; includeAll?: boolean };

  if (orgParam === "all" || orgParam === null) {
    filter = { includeAll: true };
  } else if (orgParam === "unassigned" || orgParam === "null") {
    filter = { organizationId: null };
  } else {
    filter = { organizationId: orgParam };
  }

  try {
    const members = await listOrganizationMembers(db, mn, filter);
    return NextResponse.json({ members, managementNumber: mn });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "구성원 조회 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const limited = enforceRateLimit(
    request,
    `admin:org-member:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/admin/company-registry/[mn]/members", source: "admin" }
  );
  if (limited) return limited;

  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const mn = resolveManagementNumberParam((await ctx.params).mn);
  if (!mn) return NextResponse.json({ error: "유효하지 않은 관리번호입니다." }, { status: 400 });

  const denied = assertCompanyAccess(auth.session, mn);
  if (denied) return denied;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  let body: { userId?: string; organizationId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!body.userId) return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });

  const assigned = await assignMemberOrganization(
    db,
    mn,
    body.userId,
    body.organizationId === undefined ? null : body.organizationId
  );

  if (!assigned.ok) return NextResponse.json({ error: assigned.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
