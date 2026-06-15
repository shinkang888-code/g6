/**
 * 회사(관리번호) 상세 — 조회·수정·삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/authSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import {
  deleteCompanyRegistry,
  getCompanyRegistryDetail,
  updateCompanyRegistry,
} from "@/lib/companyRegistry";
import { assertCompanyAccess, resolveManagementNumberParam } from "@/lib/companyRegistryAuth";
import { canCreateOrDeleteCompany, isPlatformSuperAdmin } from "@/lib/platformAdmin";
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

  const row = await getCompanyRegistryDetail(db, mn);
  if (!row) return NextResponse.json({ error: "회사를 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({ row, isPlatformAdmin: isPlatformSuperAdmin(auth.session) });
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const limited = enforceRateLimit(
    request,
    `admin:company-registry-patch:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/admin/company-registry/[mn]", source: "admin" }
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

  let body: { groupName?: string; memo?: string; managementNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (body.managementNumber !== undefined && !isPlatformSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "관리번호 변경은 전체관리자만 가능합니다." }, { status: 403 });
  }

  const updated = await updateCompanyRegistry(db, mn, {
    groupName: body.groupName,
    memo: body.memo,
    newManagementNumber: body.managementNumber,
  });

  if (!updated.ok) return NextResponse.json({ error: updated.error }, { status: 400 });

  const res = NextResponse.json({
    ok: true,
    row: updated.row,
    managementNumber: updated.managementNumber,
    managementNumberChanged: updated.managementNumber !== mn,
  });

  if (updated.managementNumber !== mn && auth.session.userId) {
    res.headers.set(
      "Set-Cookie",
      createSessionCookie({ ...auth.session, managementNumber: updated.managementNumber })
    );
  }

  return res;
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const limited = enforceRateLimit(
    request,
    `admin:company-registry-del:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/admin/company-registry/[mn]", source: "admin" }
  );
  if (limited) return limited;

  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  if (!canCreateOrDeleteCompany(auth.session)) {
    return NextResponse.json({ error: "회사 삭제는 전체관리자만 가능합니다." }, { status: 403 });
  }

  const mn = resolveManagementNumberParam((await ctx.params).mn);
  if (!mn) return NextResponse.json({ error: "유효하지 않은 관리번호입니다." }, { status: 400 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  const deleted = await deleteCompanyRegistry(db, mn);
  if (!deleted.ok) return NextResponse.json({ error: deleted.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
