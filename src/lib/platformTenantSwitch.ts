/**
 * 전체관리자(platform_admin) 작업 관리번호 전환
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/authSession";
import { isPlatformSuperAdmin } from "@/lib/adminRoles";
import { normalizeManagementNumber, isValidManagementNumber } from "@/lib/managementNumber";

export type SwitchableTenant = {
  managementNumber: string;
  groupName: string;
};

const DEFAULT_PLATFORM_MNS = ["00000", "10000"];

function platformManagementNumbers(): string[] {
  const fromEnv = (process.env.PLATFORM_ADMIN_MANAGEMENT_NUMBERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_PLATFORM_MNS;
}

export function resolveHomeManagementNumber(session: SessionPayload): string {
  return (
    session.homeManagementNumber?.trim() ||
    session.managementNumber?.trim() ||
    ""
  );
}

export function resolveActiveManagementNumber(session: SessionPayload): string {
  return (
    session.activeManagementNumber?.trim() ||
    session.managementNumber?.trim() ||
    resolveHomeManagementNumber(session)
  );
}

export function withActiveTenant(
  session: SessionPayload,
  activeManagementNumber: string
): SessionPayload {
  const home = resolveHomeManagementNumber(session) || activeManagementNumber;
  const active = activeManagementNumber.trim();
  return {
    ...session,
    homeManagementNumber: home,
    activeManagementNumber: active,
    managementNumber: active,
  };
}

export function buildLoginTenantSession(
  base: Omit<SessionPayload, "homeManagementNumber" | "activeManagementNumber" | "managementNumber"> & {
    managementNumber?: string;
  }
): SessionPayload {
  const home = (base.managementNumber ?? "").trim();
  const session: SessionPayload = {
    ...base,
    homeManagementNumber: home || undefined,
    activeManagementNumber: home || undefined,
    managementNumber: home || undefined,
  };
  if (isPlatformSuperAdmin(session) && home) {
    return withActiveTenant(session, home);
  }
  return session;
}

export function canSwitchTenant(session: SessionPayload): boolean {
  return isPlatformSuperAdmin(session);
}

export async function listSwitchableTenants(
  db: SupabaseClient,
  session: SessionPayload
): Promise<SwitchableTenant[]> {
  if (!canSwitchTenant(session)) return [];

  const whitelist = new Set(platformManagementNumbers());
  const { data: groups } = await db
    .from("company_groups")
    .select("management_number, group_name")
    .order("management_number", { ascending: true });

  const rows: SwitchableTenant[] = [];
  for (const g of groups ?? []) {
    const mn = String(g.management_number ?? "").trim();
    if (!isValidManagementNumber(mn)) continue;
    if (!whitelist.has(mn)) continue;
    rows.push({
      managementNumber: mn,
      groupName: String(g.group_name ?? "").trim() || `법무법인 ${mn}`,
    });
  }

  const home = resolveHomeManagementNumber(session);
  if (home && isValidManagementNumber(home) && !rows.some((r) => r.managementNumber === home)) {
    rows.unshift({
      managementNumber: home,
      groupName: `홈 관리번호 ${home}`,
    });
  }

  return rows.sort((a, b) => a.managementNumber.localeCompare(b.managementNumber));
}

export async function validateTenantSwitchTarget(
  db: SupabaseClient,
  session: SessionPayload,
  rawMn: string
): Promise<{ ok: true; managementNumber: string; groupName: string } | { ok: false; error: string }> {
  if (!canSwitchTenant(session)) {
    return { ok: false, error: "전체관리자만 관리번호를 전환할 수 있습니다." };
  }

  const normalized = normalizeManagementNumber(rawMn);
  if (!normalized) {
    return { ok: false, error: "관리번호는 5자리 숫자로 입력하세요." };
  }

  const whitelist = platformManagementNumbers();
  if (!whitelist.includes(normalized)) {
    return {
      ok: false,
      error: `관리번호 ${normalized}는 전환할 수 없습니다. (${whitelist.join(", ")})`,
    };
  }

  const { data: group } = await db
    .from("company_groups")
    .select("management_number, group_name")
    .eq("management_number", normalized)
    .maybeSingle();

  if (!group) {
    return { ok: false, error: `관리번호 ${normalized}는 등록되지 않았습니다.` };
  }

  return {
    ok: true,
    managementNumber: normalized,
    groupName: String(group.group_name ?? "").trim() || `법무법인 ${normalized}`,
  };
}
