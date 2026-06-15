/**
 * LawTop 관리번호(5자리) 정규화·테넌트 마이그레이션
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const TENANT_TABLES = [
  "site_users",
  "cases",
  "clients",
  "deadlines",
  "finance_entries",
  "bank_transactions",
  "linked_accounts",
  "billing_items",
  "billing_schedules",
  "tax_documents",
] as const;

/** 5자리 숫자 관리번호로 정규화 (예: 1 → 00001) */
export function normalizeManagementNumber(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 5) return null;
  return digits.padStart(5, "0");
}

export function isValidManagementNumber(value: string): boolean {
  return /^\d{5}$/.test(value);
}

export async function migrateTenantManagementNumber(
  db: SupabaseClient,
  oldNumber: string,
  newNumber: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidManagementNumber(oldNumber) || !isValidManagementNumber(newNumber)) {
    return { ok: false, error: "관리번호는 5자리 숫자여야 합니다." };
  }
  if (oldNumber === newNumber) return { ok: true };

  const { data: conflict } = await db
    .from("company_groups")
    .select("management_number")
    .eq("management_number", newNumber)
    .maybeSingle();

  if (conflict) {
    return { ok: false, error: `관리번호 ${newNumber}는 이미 사용 중입니다.` };
  }

  const { data: oldGroup } = await db
    .from("company_groups")
    .select("group_name, memo")
    .eq("management_number", oldNumber)
    .maybeSingle();

  const now = new Date().toISOString();

  const { error: insertErr } = await db.from("company_groups").upsert(
    {
      management_number: newNumber,
      group_name: oldGroup?.group_name ?? `법무법인 ${newNumber}`,
      memo: oldGroup?.memo ?? null,
      updated_at: now,
    },
    { onConflict: "management_number" }
  );
  if (insertErr) return { ok: false, error: insertErr.message };

  for (const table of TENANT_TABLES) {
    const { error } = await db.from(table).update({ management_number: newNumber }).eq("management_number", oldNumber);
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) continue;
      console.error(`migrate ${table}:`, error.message);
      return { ok: false, error: `${table} 마이그레이션 실패: ${error.message}` };
    }
  }

  if (oldGroup) {
    await db.from("company_groups").delete().eq("management_number", oldNumber);
  }

  return { ok: true };
}

export async function deleteCompanyGroupRecord(
  db: SupabaseClient,
  managementNumber: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from("company_groups").delete().eq("management_number", managementNumber);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
