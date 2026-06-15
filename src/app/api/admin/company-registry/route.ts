/**
 * 회사(관리번호) 레지스트리 — 전체 목록·생성 (플랫폼 관리자)
 * GET — 목록 (플랫폼: 전체 / 테넌트 관리자: 자사만)
 * POST — 신규 관리번호 등록 (플랫폼 관리자)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/authSession";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { createCompanyRegistry, listCompanyRegistry } from "@/lib/companyRegistry";
import {
  canCreateOrDeleteCompany,
  isAnyPlatformStaff,
  isPlatformDeputy,
  isPlatformSuperAdmin,
} from "@/lib/platformAdmin";
import { sessionAdminRoleLabel } from "@/lib/adminRoles";
import { getClientIdentifier, LIMIT_AUTH_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

export async function GET() {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  const all = await listCompanyRegistry(db);
  const platformStaff = isAnyPlatformStaff(auth.session);
  const platformSuper = isPlatformSuperAdmin(auth.session);

  const data = platformStaff
    ? all
    : all.filter((r) => r.managementNumber === (auth.session.managementNumber ?? "").trim());

  return NextResponse.json({
    data,
    isPlatformAdmin: platformStaff,
    isPlatformSuperAdmin: platformSuper,
    isPlatformDeputy: isPlatformDeputy(auth.session),
    adminRoleLabel: sessionAdminRoleLabel(auth.session),
    currentManagementNumber: auth.session.managementNumber ?? null,
  });
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    `admin:company-registry:${getClientIdentifier(request)}`,
    LIMIT_AUTH_PER_MIN,
    { routePath: "/api/admin/company-registry", source: "admin" }
  );
  if (limited) return limited;

  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  if (!canCreateOrDeleteCompany(auth.session)) {
    return NextResponse.json({ error: "신규 관리번호 등록은 전체관리자만 가능합니다." }, { status: 403 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 });

  let body: { managementNumber?: string; groupName?: string; memo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const created = await createCompanyRegistry(db, {
    managementNumber: body.managementNumber ?? "",
    groupName: body.groupName,
    memo: body.memo,
  });

  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });

  return NextResponse.json({ ok: true, row: created.row }, { status: 201 });
}
