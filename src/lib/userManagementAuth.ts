/**
 * 사용자 관리 API — 관리자 세션·플랫폼/사내 관리자 범위
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/authSession";
import { requireAdminSession } from "@/lib/adminSession";
import { assertUserManageableByAdmin } from "@/lib/companyRegistryAuth";
import {
  canManageCompanyWorkspace,
  isAnyPlatformStaff,
  isPlatformSuperAdmin,
} from "@/lib/adminRoles";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export type UserManagementAuth =
  | {
      session: SessionPayload;
      db: SupabaseClient;
      isPlatformStaff: boolean;
      isPlatformSuperAdmin: boolean;
    }
  | { error: NextResponse };

export async function requireUserManagementAuth(): Promise<UserManagementAuth> {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth;

  const db = getSupabaseAdmin();
  if (!db) {
    return { error: NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 }) };
  }

  const platformStaff = isAnyPlatformStaff(auth.session);
  const platformSuper = isPlatformSuperAdmin(auth.session);

  if (!platformStaff && !canManageCompanyWorkspace(auth.session, auth.session.managementNumber ?? "")) {
    return {
      error: NextResponse.json({ error: "사용자 관리 권한이 없습니다." }, { status: 403 }),
    };
  }

  return {
    session: auth.session,
    db,
    isPlatformStaff: platformStaff,
    isPlatformSuperAdmin: platformSuper,
  };
}

export async function assertUserEditableByActor(
  db: SupabaseClient,
  session: SessionPayload,
  userId: string
): Promise<{ allowed: true; managementNumber: string } | { allowed: false }> {
  return assertUserManageableByAdmin(db, session, userId);
}
