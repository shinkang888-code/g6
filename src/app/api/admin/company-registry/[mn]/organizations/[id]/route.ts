/**
 * 조직 폴더 — 수정·삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { assertCompanyAccess, resolveManagementNumberParam } from "@/lib/companyRegistryAuth";
import { deleteOrganization, updateOrganization } from "@/lib/companyOrganization";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

type RouteCtx = { params: Promise<{ mn: string; id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const limited = enforceRateLimit(
    request,
    `admin:org-patch:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/admin/company-registry/[mn]/organizations/[id]", source: "admin" }
  );
  if (limited) return limited;

  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const { mn: mnRaw, id } = await ctx.params;
  const mn = resolveManagementNumberParam(mnRaw);
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

  const updated = await updateOrganization(db, id, mn, body);
  if (!updated.ok) return NextResponse.json({ error: updated.error }, { status: 400 });
  return NextResponse.json({ ok: true, organization: updated.organization });
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const limited = enforceRateLimit(
    request,
    `admin:org-del:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/admin/company-registry/[mn]/organizations/[id]", source: "admin" }
  );
  if (limited) return limited;

  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const { mn: mnRaw, id } = await ctx.params;
  const mn = resolveManagementNumberParam(mnRaw);
  if (!mn) return NextResponse.json({ error: "유효하지 않은 관리번호입니다." }, { status: 400 });

  const denied = assertCompanyAccess(auth.session, mn);
  if (denied) return denied;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  const deleted = await deleteOrganization(db, id, mn);
  if (!deleted.ok) return NextResponse.json({ error: deleted.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
