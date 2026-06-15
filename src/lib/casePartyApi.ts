/**
 * case_parties DB ↔ 타입 매핑 및 upsert
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clientSyncInputFromParty,
  enrichPartiesWithClientMemo,
  upsertClientForCase,
} from "@/lib/caseClientSync";
import {
  buildPartiesFromLegacyCase,
  type CaseParty,
  type CasePartyInput,
  partyHasData,
  summarizePartiesForCase,
} from "@/lib/casePartyTypes";

export function partyFromRow(r: Record<string, unknown>): CaseParty {
  return {
    id: String(r.id ?? ""),
    caseId: String(r.case_id ?? ""),
    role: r.role as CaseParty["role"],
    sortOrder: Number(r.sort_order ?? 0),
    clientId: r.client_id ? String(r.client_id) : undefined,
    name: String(r.name ?? ""),
    position: (r.position as string) ?? undefined,
    isCorporate: Boolean(r.is_corporate),
    phone: (r.phone as string) ?? undefined,
    mobile: (r.mobile as string) ?? undefined,
    fax: (r.fax as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    address: (r.address as string) ?? undefined,
    idNumber: (r.id_number as string) ?? undefined,
    bizNumber: (r.biz_number as string) ?? undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

export function partyToRow(
  caseId: string,
  party: CasePartyInput
): Record<string, unknown> {
  return {
    case_id: caseId,
    role: party.role,
    sort_order: party.sortOrder ?? 0,
    client_id: party.clientId ?? null,
    name: party.name.trim(),
    position: party.position?.trim() || null,
    is_corporate: Boolean(party.isCorporate),
    phone: party.phone?.trim() || null,
    mobile: party.mobile?.trim() || null,
    fax: party.fax?.trim() || null,
    email: party.email?.trim() || null,
    address: party.address?.trim() || null,
    id_number: party.idNumber?.trim() || null,
    biz_number: party.bizNumber?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export function partyInputFromParty(p: CaseParty): CasePartyInput {
  return {
    id: p.id,
    role: p.role,
    sortOrder: p.sortOrder,
    clientId: p.clientId,
    name: p.name,
    position: p.position ?? "",
    isCorporate: p.isCorporate ?? false,
    phone: p.phone ?? "",
    mobile: p.mobile ?? "",
    fax: p.fax ?? "",
    email: p.email ?? "",
    address: p.address ?? "",
    idNumber: p.idNumber ?? "",
    bizNumber: p.bizNumber ?? "",
    clientMemo: p.clientMemo,
  };
}

export async function loadCaseParties(
  db: SupabaseClient,
  caseId: string,
  options?: { seedFromCase?: boolean }
): Promise<CaseParty[]> {
  const { data, error } = await db
    .from("case_parties")
    .select("*")
    .eq("case_id", caseId)
    .order("role", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  if (data?.length) {
    const parties = data.map((r) => partyFromRow(r as Record<string, unknown>));
    return enrichPartiesWithClientMemo(db, parties);
  }

  if (options?.seedFromCase === false) return [];

  const { data: caseRow, error: caseErr } = await db
    .from("cases")
    .select("client_name, client_position, opponent_name, client_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr) throw new Error(caseErr.message);
  if (!caseRow) return [];

  const seed = buildPartiesFromLegacyCase(caseRow as Record<string, unknown>);
  if (seed.length === 0) return [];

  await upsertCaseParties(db, caseId, seed, { skipCaseSync: true });
  const seeded = await loadCaseParties(db, caseId, { seedFromCase: false });
  return enrichPartiesWithClientMemo(db, seeded);
}

export async function syncCaseRowFromParties(
  db: SupabaseClient,
  caseId: string,
  parties: CasePartyInput[]
): Promise<void> {
  const summary = summarizePartiesForCase(parties);
  const { error } = await db
    .from("cases")
    .update({
      client_name: summary.clientName,
      client_position: summary.clientPosition || null,
      opponent_name: summary.opponentName || null,
      client_id: summary.clientId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);
  if (error) throw new Error(error.message);
}

export async function upsertCaseParties(
  db: SupabaseClient,
  caseId: string,
  parties: CasePartyInput[],
  options?: { skipCaseSync?: boolean; skipReload?: boolean }
): Promise<CaseParty[]> {
  const existing = await loadCaseParties(db, caseId, { seedFromCase: false });
  const existingIds = new Set(existing.map((p) => p.id));
  const keptIds = new Set<string>();

  const toSave = parties.filter(partyHasData);

  for (const party of toSave) {
    let clientId = party.clientId;
    if (party.role === "client") {
      try {
        const id = await upsertClientForCase(db, clientSyncInputFromParty(party));
        if (id) clientId = id;
      } catch {
        // clients 연동 실패해도 party 저장
      }
    }

    const row = partyToRow(caseId, { ...party, clientId });

    if (party.id && existingIds.has(party.id)) {
      keptIds.add(party.id);
      const { error } = await db.from("case_parties").update(row).eq("id", party.id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db
        .from("case_parties")
        .insert(row)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      if (data?.id) keptIds.add(String(data.id));
    }
  }

  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await db.from("case_parties").delete().in("id", toDelete);
    if (error) throw new Error(error.message);
  }

  if (!options?.skipCaseSync) {
    const refreshed = await loadCaseParties(db, caseId, { seedFromCase: false });
    await syncCaseRowFromParties(
      db,
      caseId,
      refreshed.map(partyInputFromParty)
    );
    if (options?.skipReload) return [];
    return refreshed;
  }

  if (options?.skipReload) return [];
  return loadCaseParties(db, caseId, { seedFromCase: false });
}

/** 엑셀 import 후 parties 시드 */
export function buildPartiesFromImport(item: Record<string, unknown>): CasePartyInput[] {
  return buildPartiesFromLegacyCase(item);
}
