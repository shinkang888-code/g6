/**
 * LawTop 스타일 관리번호(회사) 테넌트 격리
 * — 동일 management_number 구성원만 사건·고객·기일 공유
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession, type SessionPayload } from "@/lib/authSession";
import { resolveActiveManagementNumber } from "@/lib/platformTenantSwitch";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { assertTenantSubscriptionAccess } from "@/lib/subscription/subscriptionGate";
import { ensureTenantSubscription } from "@/lib/subscription/subscriptionService";

export type TenantSession = SessionPayload & { managementNumber: string };

export async function resolveManagementNumber(
  session: SessionPayload,
  db?: SupabaseClient | null
): Promise<string | null> {
  const fromSession = resolveActiveManagementNumber(session);
  if (fromSession) return fromSession;

  const client = db ?? getSupabaseAdmin();
  if (!client) return null;

  const { data } = await client
    .from("site_users")
    .select("management_number")
    .eq("id", session.userId)
    .maybeSingle();

  const mgmt = (data?.management_number as string | undefined)?.trim();
  return mgmt || null;
}

export async function requireTenantSession(opts?: {
  pathname?: string;
}): Promise<
  | { session: TenantSession; db: SupabaseClient; managementNumber: string }
  | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return { error: NextResponse.json({ error: "DB가 연결되지 않았습니다." }, { status: 503 }) };
  }

  const managementNumber = await resolveManagementNumber(session, db);
  if (!managementNumber) {
    return {
      error: NextResponse.json(
        { error: "관리번호(회사)가 설정되지 않았습니다. 관리자에게 문의하세요." },
        { status: 403 }
      ),
    };
  }

  const subAccess = await assertTenantSubscriptionAccess(
    db,
    session,
    managementNumber,
    opts?.pathname
  );
  if (!subAccess.allowed) {
    return {
      error: NextResponse.json(
        {
          error: subAccess.reason ?? "구독이 만료되어 이용할 수 없습니다.",
          code: subAccess.code ?? "SUBSCRIPTION_REQUIRED",
          subscriptionStatus: subAccess.status,
          billingRequired: subAccess.billingRequired ?? true,
        },
        { status: 402 }
      ),
    };
  }

  return {
    session: { ...session, managementNumber },
    db,
    managementNumber,
  };
}

/** Supabase 쿼리 빌더에 테넌트 필터 적용 */
export function applyTenantFilter<Q>(query: Q, managementNumber: string): Q {
  const q = query as { eq: (col: string, val: string) => Q };
  return q.eq("management_number", managementNumber);
}

export function tenantRowFields(managementNumber: string): { management_number: string } {
  return { management_number: managementNumber };
}

export async function assertCaseInTenant(
  db: SupabaseClient,
  caseId: string,
  managementNumber: string
): Promise<boolean> {
  const { data } = await db
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("management_number", managementNumber)
    .maybeSingle();
  return Boolean(data);
}

export async function assertClientInTenant(
  db: SupabaseClient,
  clientId: string,
  managementNumber: string
): Promise<boolean> {
  const { data } = await db
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("management_number", managementNumber)
    .maybeSingle();
  return Boolean(data);
}

export async function assertUserInTenant(
  db: SupabaseClient,
  userId: string,
  managementNumber: string
): Promise<boolean> {
  const { data } = await db
    .from("site_users")
    .select("id")
    .eq("id", userId)
    .eq("management_number", managementNumber)
    .maybeSingle();
  return Boolean(data);
}

export async function ensureCompanyGroup(
  db: SupabaseClient,
  managementNumber: string,
  groupName?: string
): Promise<void> {
  const name = (groupName ?? "").trim() || `법무법인 ${managementNumber}`;
  await db.from("company_groups").upsert(
    {
      management_number: managementNumber,
      group_name: name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "management_number" }
  );
  try {
    await ensureTenantSubscription(db, managementNumber);
  } catch {
    /* 구독 레코드 생성 실패는 회사 그룹 생성을 막지 않음 */
  }
}

export type CompanyGroupSummary = {
  managementNumber: string;
  groupName: string;
  memberCount: number;
  activeMemberCount: number;
  caseCount: number;
  clientCount: number;
};
