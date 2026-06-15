/**
 * 회사 레지스트리 API 공통 — 관리번호 파라미터·접근 권한
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/authSession";
import { normalizeManagementNumber } from "@/lib/managementNumber";
import { canManageCompany } from "@/lib/platformAdmin";

export function resolveManagementNumberParam(raw: string): string | null {
  return normalizeManagementNumber(decodeURIComponent(raw));
}

export function assertCompanyAccess(session: SessionPayload, mn: string): NextResponse | null {
  if (!canManageCompany(session, mn)) {
    return NextResponse.json({ error: "해당 회사에 대한 관리 권한이 없습니다." }, { status: 403 });
  }
  return null;
}

/** 관리자가 대상 회원의 관리번호에 접근·심사할 수 있는지 (플랫폼 관리자 교차 테넌트 포함) */
export async function assertUserManageableByAdmin(
  db: SupabaseClient,
  session: SessionPayload,
  userId: string
): Promise<{ allowed: true; managementNumber: string } | { allowed: false }> {
  const { data } = await db
    .from("site_users")
    .select("id, management_number")
    .eq("id", userId)
    .maybeSingle();

  const mn = (data?.management_number as string | undefined)?.trim();
  if (!data || !mn) return { allowed: false };
  if (!canManageCompany(session, mn)) return { allowed: false };
  return { allowed: true, managementNumber: mn };
}
