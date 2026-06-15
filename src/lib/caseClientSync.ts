/**
 * 사건 등록 시 의뢰인 clients 테이블 upsert (서버 전용)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { clientToRow } from "@/lib/clientApi";

export type CaseClientSyncInput = {
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;
  position?: string;
  idNumber?: string;
  bizNumber?: string;
  guestCode?: string;
  /** clients.memo — undefined면 기존 메모 유지(patch 시) */
  memo?: string;
};

function digitsOnly(v?: string): string {
  return String(v ?? "").replace(/\D/g, "");
}

function buildClientPatchRow(input: CaseClientSyncInput): Record<string, unknown> {
  const landline = String(input.phone ?? "").trim() || null;
  const mobile = String(input.mobile ?? "").trim() || null;
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    contact_phone: landline ?? mobile,
    contact_mobile: mobile ?? landline,
    updated_at: new Date().toISOString(),
  };
  if (input.email !== undefined) patch.contact_email = input.email.trim() || null;
  if (input.address !== undefined) patch.address = input.address.trim() || null;
  if (input.position !== undefined) patch.position = input.position.trim() || null;
  if (input.idNumber !== undefined) patch.id_number = input.idNumber.trim() || null;
  if (input.bizNumber !== undefined) patch.biz_number = input.bizNumber.trim() || null;
  if (input.guestCode !== undefined) patch.guest_code = input.guestCode.trim() || null;
  if (input.memo !== undefined) patch.memo = input.memo.trim() || null;
  return patch;
}

export async function upsertClientForCase(
  db: SupabaseClient,
  input: CaseClientSyncInput,
  managementNumber?: string
): Promise<string | null> {
  const name = input.name.trim();
  if (!name) return null;
  const mgmt = managementNumber?.trim();

  if (input.guestCode?.trim()) {
    let codeQuery = db
      .from("clients")
      .select("id")
      .eq("guest_code", input.guestCode.trim())
      .is("deleted_at", null);
    if (mgmt) codeQuery = codeQuery.eq("management_number", mgmt);
    const { data: byCode } = await codeQuery.maybeSingle();
    if (byCode?.id) {
      await patchClient(db, String(byCode.id), input);
      return String(byCode.id);
    }
  }

  const mobile = digitsOnly(input.mobile);
  const phone = digitsOnly(input.phone);

  let candidateQuery = db
    .from("clients")
    .select("id, contact_phone, contact_mobile")
    .eq("name", name)
    .is("deleted_at", null);
  if (mgmt) candidateQuery = candidateQuery.eq("management_number", mgmt);
  const { data: candidates, error } = await candidateQuery.limit(20);
  if (error) throw new Error(error.message);

  const match = (candidates ?? []).find((c) => {
    const cm = digitsOnly(c.contact_mobile as string);
    const cp = digitsOnly(c.contact_phone as string);
    if (mobile && (cm === mobile || cp === mobile)) return true;
    if (phone && (cp === phone || cm === phone)) return true;
    if (!mobile && !phone) return true;
    return false;
  });

  if (match?.id) {
    await patchClient(db, String(match.id), input);
    return String(match.id);
  }

  const row = clientToRow({
    name,
    phone: input.phone,
    mobile: input.mobile,
    email: input.email,
    address: input.address,
    position: input.position,
    idNumber: input.idNumber,
    bizNumber: input.bizNumber,
    guestCode: input.guestCode,
    ...(input.memo !== undefined ? { memo: input.memo } : {}),
  }, mgmt);
  if (!row) return null;

  const { data: inserted, error: insErr } = await db
    .from("clients")
    .insert(row)
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return inserted?.id ? String(inserted.id) : null;
}

async function patchClient(
  db: SupabaseClient,
  id: string,
  input: CaseClientSyncInput
): Promise<void> {
  const patch = buildClientPatchRow(input);
  const { error } = await db.from("clients").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** case_parties 조회 후 clients.memo를 의뢰인 당사자에 붙임 */
export async function enrichPartiesWithClientMemo<T extends { role: string; clientId?: string; clientMemo?: string }>(
  db: SupabaseClient,
  parties: T[]
): Promise<T[]> {
  const clientIds = [
    ...new Set(
      parties
        .filter((p) => p.role === "client" && p.clientId)
        .map((p) => p.clientId as string)
    ),
  ];
  if (clientIds.length === 0) return parties;

  const { data, error } = await db.from("clients").select("id, memo").in("id", clientIds);
  if (error) throw new Error(error.message);

  const memoById = new Map(
    (data ?? []).map((c) => [String(c.id), (c.memo as string | null) ?? ""])
  );

  return parties.map((p) => {
    if (p.role !== "client" || !p.clientId) return p;
    return { ...p, clientMemo: memoById.get(p.clientId) ?? "" };
  });
}

export function clientSyncInputFromParty(party: {
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;
  position?: string;
  idNumber?: string;
  bizNumber?: string;
  clientMemo?: string;
}): CaseClientSyncInput {
  return {
    name: party.name,
    phone: party.phone,
    mobile: party.mobile,
    email: party.email,
    address: party.address,
    position: party.position,
    idNumber: party.idNumber,
    bizNumber: party.bizNumber,
    ...(party.clientMemo !== undefined ? { memo: party.clientMemo } : {}),
  };
}
