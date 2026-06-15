/**
 * 회사별 Google·일반 가입 승인 대기 목록
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminSession } from "@/lib/adminSession";
import { assertCompanyAccess, resolveManagementNumberParam } from "@/lib/companyRegistryAuth";
import type { SiteUserRow } from "@/lib/userAdmin";

const SIGNUP_QUEUE_STATUSES = ["pending", "on_hold", "rejected"] as const;
const USER_SELECT =
  "id, login_id, management_number, status, name, role, department, email, phone, profile, permission_role_id, created_at, approved_at, approved_by, resigned_at, resigned_by, resign_reason, google_email, auth_provider, organization_id";

async function loadSignupQueue(db: SupabaseClient, managementNumber: string) {
  const { data } = await db
    .from("site_users")
    .select(USER_SELECT)
    .eq("management_number", managementNumber)
    .in("status", [...SIGNUP_QUEUE_STATUSES])
    .order("created_at", { ascending: false });
  return (data ?? []) as SiteUserRow[];
}

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

  const signupQueue = await loadSignupQueue(db, mn);
  return NextResponse.json({ signupQueue, managementNumber: mn });
}
