/**
 * case_institutions DB ↔ 타입 매핑 및 upsert
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CASE_INSTITUTION_STAGES,
  type CaseInstitution,
  type CaseInstitutionInput,
  type CaseInstitutionStage,
  extractPhoneFromCourtDivision,
  institutionHasData,
  inferTrialLevel,
  trialLevelToCourtStage,
} from "./caseInstitutionTypes";

export function institutionFromRow(r: Record<string, unknown>): CaseInstitution {
  return {
    id: String(r.id ?? ""),
    caseId: String(r.case_id ?? ""),
    stage: r.stage as CaseInstitutionStage,
    sortOrder: Number(r.sort_order ?? 0),
    agencyName: (r.agency_name as string) ?? undefined,
    caseNumber: (r.case_number as string) ?? undefined,
    caseName: (r.case_name as string) ?? undefined,
    department: (r.department as string) ?? undefined,
    contactName: (r.contact_name as string) ?? undefined,
    phone: (r.phone as string) ?? undefined,
    mobile: (r.mobile as string) ?? undefined,
    fax: (r.fax as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    room: (r.room as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    detentionAgency: (r.detention_agency as string) ?? undefined,
    detentionNumber: (r.detention_number as string) ?? undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

export function institutionToRow(
  caseId: string,
  inst: CaseInstitutionInput
): Record<string, unknown> {
  const meta = CASE_INSTITUTION_STAGES.find((s) => s.value === inst.stage);
  return {
    case_id: caseId,
    stage: inst.stage,
    sort_order: inst.sortOrder ?? meta?.sortOrder ?? 0,
    agency_name: inst.agencyName?.trim() || null,
    case_number: inst.caseNumber?.trim() || null,
    case_name: inst.caseName?.trim() || null,
    department: inst.department?.trim() || null,
    contact_name: inst.contactName?.trim() || null,
    phone: inst.phone?.trim() || null,
    mobile: inst.mobile?.trim() || null,
    fax: inst.fax?.trim() || null,
    email: inst.email?.trim() || null,
    room: inst.room?.trim() || null,
    notes: inst.notes?.trim() || null,
    detention_agency: inst.detentionAgency?.trim() || null,
    detention_number: inst.detentionNumber?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export function institutionsToMap(
  list: CaseInstitution[]
): Partial<Record<CaseInstitutionStage, CaseInstitution>> {
  const map: Partial<Record<CaseInstitutionStage, CaseInstitution>> = {};
  for (const inst of list) {
    map[inst.stage] = inst;
  }
  return map;
}

export function resolveActiveCourtFromInstitutions(
  institutions: CaseInstitutionInput[],
  activeStage?: CaseInstitutionStage | null
): { court: string; caseNumber?: string } | null {
  if (!activeStage) return null;
  const active = institutions.find((i) => i.stage === activeStage && institutionHasData(i));
  if (!active?.agencyName?.trim()) return null;
  return {
    court: active.agencyName.trim(),
    caseNumber: active.caseNumber?.trim() || undefined,
  };
}

export async function loadCaseInstitutions(
  db: SupabaseClient,
  caseId: string
): Promise<CaseInstitution[]> {
  const { data, error } = await db
    .from("case_institutions")
    .select("*")
    .eq("case_id", caseId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => institutionFromRow(r as Record<string, unknown>));
}

export async function upsertCaseInstitutions(
  db: SupabaseClient,
  caseId: string,
  institutions: CaseInstitutionInput[],
  options?: { activeStage?: CaseInstitutionStage | null; skipReload?: boolean }
): Promise<CaseInstitution[]> {
  const rows = institutions
    .filter(institutionHasData)
    .map((inst) => institutionToRow(caseId, inst));

  if (rows.length > 0) {
    const { error } = await db
      .from("case_institutions")
      .upsert(rows, { onConflict: "case_id,stage" });
    if (error) throw new Error(error.message);
  }

  const casePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (options?.activeStage) {
    casePatch.active_stage = options.activeStage;
    const resolved = resolveActiveCourtFromInstitutions(institutions, options.activeStage);
    if (resolved?.court) casePatch.court = resolved.court;
    if (resolved?.caseNumber) casePatch.case_number = resolved.caseNumber;
  }

  if (Object.keys(casePatch).length > 1) {
    const { error: caseErr } = await db.from("cases").update(casePatch).eq("id", caseId);
    if (caseErr) throw new Error(caseErr.message);
  }

  if (options?.skipReload) return [];
  return loadCaseInstitutions(db, caseId);
}

/** 엑셀 import 시 court + court_division → institution 1행 생성 */
export function buildInstitutionFromImport(item: Record<string, unknown>): CaseInstitutionInput | null {
  const court = String(item.court ?? "").trim();
  const courtDivision = String(item.courtDivision ?? item.court_division ?? "").trim();
  const caseNumber = String(item.caseNumber ?? item.case_number ?? "").trim();
  const caseName = String(item.caseName ?? item.case_name ?? "").trim();
  if (!court && !courtDivision) return null;

  const trialLevel = String(item.trialLevel ?? item.trial_level ?? inferTrialLevel(caseNumber));
  const stage = trialLevelToCourtStage(trialLevel);
  const phone = extractPhoneFromCourtDivision(courtDivision);

  return {
    stage,
    sortOrder: CASE_INSTITUTION_STAGES.find((s) => s.value === stage)?.sortOrder ?? 2,
    agencyName: court || undefined,
    caseNumber: caseNumber || undefined,
    caseName: caseName || undefined,
    department: courtDivision || undefined,
    phone: phone || undefined,
  };
}
