/**
 * 회사(관리번호) 레지스트리 — 목록·생성·수정·삭제
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteCompanyGroupRecord,
  isValidManagementNumber,
  migrateTenantManagementNumber,
  normalizeManagementNumber,
} from "@/lib/managementNumber";
import { ensureCompanyGroup } from "@/lib/tenantScope";
import { isActiveUserStatus } from "@/lib/userAdmin";
import { ensureDefaultOrganization, type CompanyOrganizationRow } from "@/lib/companyOrganization";

export type CompanyRegistryRow = {
  managementNumber: string;
  groupName: string;
  memo: string;
  memberCount: number;
  activeMemberCount: number;
  pendingSignupCount: number;
  caseCount: number;
  clientCount: number;
  organizationCount: number;
  hasRecord: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const SIGNUP_PENDING = ["pending", "on_hold", "rejected"] as const;

export async function listCompanyRegistry(db: SupabaseClient): Promise<CompanyRegistryRow[]> {
  const { data: groups } = await db
    .from("company_groups")
    .select("management_number, group_name, memo, created_at, updated_at")
    .order("management_number", { ascending: true });

  const { data: userRows } = await db
    .from("site_users")
    .select("management_number, status")
    .not("management_number", "is", null);

  const orphanMns = new Set<string>();
  for (const u of userRows ?? []) {
    const mn = String(u.management_number ?? "").trim();
    if (mn) orphanMns.add(mn);
  }

  const groupMap = new Map<string, (typeof groups extends (infer G)[] | null ? G : never)>();
  for (const g of groups ?? []) {
    groupMap.set(String(g.management_number), g);
    orphanMns.delete(String(g.management_number));
  }

  const allMns = [...groupMap.keys(), ...orphanMns].sort();

  const statsByMn = new Map<
    string,
    { memberCount: number; activeMemberCount: number; pendingSignupCount: number }
  >();
  for (const u of userRows ?? []) {
    const mn = String(u.management_number ?? "").trim();
    if (!mn) continue;
    const cur = statsByMn.get(mn) ?? { memberCount: 0, activeMemberCount: 0, pendingSignupCount: 0 };
    cur.memberCount += 1;
    const st = String(u.status ?? "");
    if (isActiveUserStatus(st)) cur.activeMemberCount += 1;
    if ((SIGNUP_PENDING as readonly string[]).includes(st)) cur.pendingSignupCount += 1;
    statsByMn.set(mn, cur);
  }

  const rows: CompanyRegistryRow[] = [];

  for (const mn of allMns) {
    const g = groupMap.get(mn);
    const stats = statsByMn.get(mn) ?? { memberCount: 0, activeMemberCount: 0, pendingSignupCount: 0 };

    const [{ count: caseCount }, { count: clientCount }, orgCount] = await Promise.all([
      db.from("cases").select("id", { count: "exact", head: true }).eq("management_number", mn),
      db
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("management_number", mn)
        .is("deleted_at", null),
      countOrganizations(db, mn),
    ]);

    rows.push({
      managementNumber: mn,
      groupName: String(g?.group_name ?? `법무법인 ${mn}`),
      memo: String(g?.memo ?? ""),
      memberCount: stats.memberCount,
      activeMemberCount: stats.activeMemberCount,
      pendingSignupCount: stats.pendingSignupCount,
      caseCount: caseCount ?? 0,
      clientCount: clientCount ?? 0,
      organizationCount: orgCount,
      hasRecord: Boolean(g),
      createdAt: g?.created_at ?? null,
      updatedAt: g?.updated_at ?? null,
    });
  }

  return rows;
}

export async function getCompanyRegistryDetail(
  db: SupabaseClient,
  managementNumber: string
): Promise<CompanyRegistryRow | null> {
  const list = await listCompanyRegistry(db);
  return list.find((r) => r.managementNumber === managementNumber) ?? null;
}

export async function createCompanyRegistry(
  db: SupabaseClient,
  input: { managementNumber: string; groupName?: string; memo?: string }
): Promise<{ ok: true; row: CompanyRegistryRow } | { ok: false; error: string }> {
  const mn = normalizeManagementNumber(input.managementNumber);
  if (!mn) return { ok: false, error: "관리번호는 5자리 숫자로 입력하세요." };

  const { data: existing } = await db
    .from("company_groups")
    .select("management_number")
    .eq("management_number", mn)
    .maybeSingle();
  if (existing) return { ok: false, error: `관리번호 ${mn}는 이미 등록되어 있습니다.` };

  const groupName = (input.groupName ?? "").trim() || `법무법인 ${mn}`;
  await ensureCompanyGroup(db, mn, groupName);

  const now = new Date().toISOString();
  const { error } = await db.from("company_groups").upsert(
    {
      management_number: mn,
      group_name: groupName,
      memo: (input.memo ?? "").trim() || null,
      updated_at: now,
    },
    { onConflict: "management_number" }
  );
  if (error) return { ok: false, error: error.message };

  await ensureDefaultOrganization(db, mn);

  const row = await getCompanyRegistryDetail(db, mn);
  if (!row) return { ok: false, error: "생성 후 조회에 실패했습니다." };
  return { ok: true, row };
}

export async function updateCompanyRegistry(
  db: SupabaseClient,
  managementNumber: string,
  input: { groupName?: string; memo?: string; newManagementNumber?: string }
): Promise<
  | { ok: true; managementNumber: string; row: CompanyRegistryRow }
  | { ok: false; error: string }
> {
  let effectiveMn = managementNumber;

  if (input.newManagementNumber !== undefined) {
    const normalized = normalizeManagementNumber(input.newManagementNumber);
    if (!normalized) return { ok: false, error: "관리번호는 5자리 숫자로 입력하세요." };
    if (normalized !== managementNumber) {
      const migrated = await migrateTenantManagementNumber(db, managementNumber, normalized);
      if (!migrated.ok) return { ok: false, error: migrated.error };
      effectiveMn = normalized;
    }
  }

  await ensureCompanyGroup(db, effectiveMn, input.groupName);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.groupName !== undefined) patch.group_name = input.groupName.trim() || `법무법인 ${effectiveMn}`;
  if (input.memo !== undefined) patch.memo = input.memo.trim() || null;

  const { error } = await db.from("company_groups").update(patch).eq("management_number", effectiveMn);
  if (error) return { ok: false, error: error.message };

  const row = await getCompanyRegistryDetail(db, effectiveMn);
  if (!row) return { ok: false, error: "수정 후 조회에 실패했습니다." };
  return { ok: true, managementNumber: effectiveMn, row };
}

export async function deleteCompanyRegistry(
  db: SupabaseClient,
  managementNumber: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidManagementNumber(managementNumber)) {
    return { ok: false, error: "유효하지 않은 관리번호입니다." };
  }

  const { count: activeMembers } = await db
    .from("site_users")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber)
    .in("status", ["active", "approved", "pending", "on_hold"]);

  if ((activeMembers ?? 0) > 0) {
    return {
      ok: false,
      error: "구성원 또는 가입 대기 회원이 있어 삭제할 수 없습니다. 먼저 회원을 이전·삭제하세요.",
    };
  }

  const { count: caseCount } = await db
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("management_number", managementNumber);
  if ((caseCount ?? 0) > 0) {
    return { ok: false, error: "연결된 사건 데이터가 있어 삭제할 수 없습니다." };
  }

  await db.from("company_organizations").delete().eq("management_number", managementNumber);
  const deleted = await deleteCompanyGroupRecord(db, managementNumber);
  if (!deleted.ok) return deleted;
  return { ok: true };
}

export type { CompanyOrganizationRow };

async function countOrganizations(db: SupabaseClient, mn: string): Promise<number> {
  const { count, error } = await db
    .from("company_organizations")
    .select("id", { count: "exact", head: true })
    .eq("management_number", mn);
  if (error) return 0;
  return count ?? 0;
}
