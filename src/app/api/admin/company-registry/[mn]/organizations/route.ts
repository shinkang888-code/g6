/**
 * 회사 하위 조직 폴더 — 트리 조회·생성
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { assertCompanyAccess, resolveManagementNumberParam } from "@/lib/companyRegistryAuth";
import { buildOrganizationTree, createOrganization } from "@/lib/companyOrganization";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

type RouteCtx = { params: Promise<{ mn: string }> };

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const mn = resolveManagementNumberParam((await ctx.params).mn);
  if (!mn) return NextResponse.json({ error: "유효하지 않은 관리번호입니다." }, { status: 400 });

  const denied = assertCompanyAccess(auth.session, mn);
  if (denied) return denied;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  try {
    const tree = await buildOrganizationTree(db, mn);
    return NextResponse.json({ tree, managementNumber: mn });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "조직 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const limited = enforceRateLimit(
    request,
    `admin:org-create:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/admin/company-registry/[mn]/organizations", source: "admin" }
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

  let body: { name?: string; parentId?: string | null; memo?: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const created = await createOrganization(db, {
    managementNumber: mn,
    name: body.name ?? "",
    parentId: body.parentId ?? null,
    memo: body.memo,
    sortOrder: body.sortOrder,
  });

  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });
  return NextResponse.json({ ok: true, organization: created.organization }, { status: 201 });
}
