/**
 * 사건 엑셀 import 분류·등록 (API preview/POST 공통)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeClientNameForClosedStatus } from "@/lib/caseExcel";
import {
  buildInstitutionFromImport,
  institutionToRow,
  resolveActiveCourtFromInstitutions,
} from "@/lib/caseInstitutionApi";
import { buildPartiesFromImport, upsertCaseParties } from "@/lib/casePartyApi";
import { insertCaseAuditLog, resolveAuditActor } from "@/lib/caseAuditLog";
import type { NextRequest } from "next/server";
import { trialLevelToCourtStage } from "@/lib/caseInstitutionTypes";

export type CaseDbInsertRow = {
  case_number: string;
  case_type: string;
  case_name: string;
  court: string;
  client_name: string;
  client_position: string;
  opponent_name: string;
  status: string;
  assigned_staff_name: string;
  assistants: string;
  received_date: string;
  amount: number;
  received_amount: number;
  pending_amount: number;
  is_electronic: boolean;
  is_urgent: boolean;
  is_immutable_deadline: boolean;
  notes: string;
  court_division?: string | null;
  trial_level?: string | null;
  management_key?: string | null;
  active_stage?: string | null;
  client_id?: string | null;
  registered_date?: string | null;
  created_by_name?: string | null;
  management_number?: string | null;
};

export type CaseImportRowStatus = "insert" | "duplicate_db" | "duplicate_batch" | "invalid";

export type CaseImportPlanRow = {
  excelRow: number;
  caseNumber: string;
  clientName: string;
  caseName: string;
  court: string;
  assignedStaff: string;
  status: CaseImportRowStatus;
  reason: string;
  item: Record<string, unknown> | null;
};

export type CaseImportPlan = {
  rows: CaseImportPlanRow[];
  toInsert: CaseDbInsertRow[];
  summary: {
    total: number;
    insert: number;
    duplicateDb: number;
    duplicateBatch: number;
    invalid: number;
  };
};

function toBool(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "O" || s === "1" || s === "TRUE" || s === "예" || s === "ELEC";
}

function toDateString(v: unknown): string {
  if (v === undefined || v === null) return new Date().toISOString().slice(0, 10);
  if (typeof v === "number" && v > 10000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (s.length >= 10) return s.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function caseItemToDbRow(
  item: Record<string, unknown>,
  managementNumber?: string
): CaseDbInsertRow {
  const receivedRaw = item.receivedDate ?? item.received_date;
  const rawClientName = String(item.clientName ?? item.client_name ?? "").trim() || "(의뢰인 없음)";
  const { name: client_name, status: closedOverride } = normalizeClientNameForClosedStatus(rawClientName);
  const mgmt = (managementNumber ?? item.managementNumber ?? item.management_number ?? "").toString().trim();
  return {
    case_number: String(item.caseNumber ?? item.case_number ?? "").trim() || "미등록",
    case_type: String(item.caseType ?? item.case_type ?? "민사").trim() || "민사",
    case_name: String(item.caseName ?? item.case_name ?? "").trim() || "(사건명 없음)",
    court: String(item.court ?? "").trim() || "미정",
    client_name: client_name || "(의뢰인 없음)",
    client_position: (item.clientPosition ?? item.client_position ?? "") as string,
    opponent_name: (item.opponentName ?? item.opponent_name ?? "") as string,
    status: String(closedOverride ?? item.status ?? "진행중"),
    assigned_staff_name: String(item.assignedStaff ?? item.assigned_staff_name ?? "").trim() || "미배정",
    assistants: (item.assistants ?? "") as string,
    received_date: toDateString(receivedRaw),
    amount: Number(item.amount ?? 0),
    received_amount: Number(item.receivedAmount ?? item.received_amount ?? 0),
    pending_amount: Number(item.pendingAmount ?? item.pending_amount ?? 0),
    is_electronic: toBool(item.isElectronic ?? item.is_electronic),
    is_urgent: toBool(item.isUrgent ?? item.is_urgent),
    is_immutable_deadline: toBool(item.isImmutable ?? item.is_immutable_deadline),
    notes: (item.notes ?? "") as string,
    court_division: strOrNull(item.courtDivision ?? item.court_division),
    trial_level: strOrNull(item.trialLevel ?? item.trial_level),
    management_key: strOrNull(item.managementKey ?? item.management_key),
    active_stage: strOrNull(item.activeStage ?? item.active_stage),
    client_id: strOrNull(item.clientId ?? item.client_id),
    registered_date:
      item.registeredDate ?? item.registered_date
        ? toDateString(item.registeredDate ?? item.registered_date)
        : null,
    created_by_name: strOrNull(item.createdByName ?? item.created_by_name) ?? null,
    management_number: mgmt || null,
  };
}

function strOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

type ExistingKeySets = {
  existingKeys: Set<string>;
  existingCaseClient: Set<string>;
};

/** 중복 검사용 — import fingerprint 와 동일한 컬럼만 조회 */
const IMPORT_DEDUP_SELECT =
  "case_number,case_type,case_name,court,client_name,client_position,opponent_name,status,assigned_staff_name,assistants,received_date,amount,received_amount,pending_amount,is_electronic,is_urgent,is_immutable_deadline,notes,court_division,trial_level,management_key,active_stage,client_id,registered_date,created_by_name,management_number";

function dbRowToImportFingerprint(r: Record<string, unknown>): string {
  return JSON.stringify(
    caseItemToDbRow({
      caseNumber: r.case_number,
      caseType: r.case_type,
      caseName: r.case_name,
      court: r.court,
      clientName: r.client_name,
      clientPosition: r.client_position,
      opponentName: r.opponent_name,
      status: r.status,
      assignedStaff: r.assigned_staff_name,
      assistants: r.assistants,
      receivedDate: r.received_date,
      amount: r.amount,
      receivedAmount: r.received_amount,
      pendingAmount: r.pending_amount,
      isElectronic: r.is_electronic,
      isUrgent: r.is_urgent,
      isImmutable: r.is_immutable_deadline,
      notes: r.notes,
      courtDivision: r.court_division,
      trialLevel: r.trial_level,
      managementKey: r.management_key,
      activeStage: r.active_stage,
      clientId: r.client_id,
      registeredDate: r.registered_date,
      createdByName: r.created_by_name,
      managementNumber: r.management_number,
    })
  );
}

export async function loadExistingCaseKeySets(
  db: SupabaseClient,
  managementNumber?: string
): Promise<ExistingKeySets> {
  const existingKeys = new Set<string>();
  const existingCaseClient = new Set<string>();
  const pageSizeLoad = 1000;
  let from = 0;

  while (true) {
    let query = db.from("cases").select(IMPORT_DEDUP_SELECT);
    if (managementNumber?.trim()) {
      query = query.eq("management_number", managementNumber.trim());
    }
    const { data: chunk, error } = await query.range(from, from + pageSizeLoad - 1);
    if (error) throw new Error(error.message);
    if (!chunk?.length) break;

    for (const r of chunk as Record<string, unknown>[]) {
      existingKeys.add(dbRowToImportFingerprint(r));
      existingCaseClient.add(
        `${String(r.case_number ?? "").trim()}|${String(r.client_name ?? "").trim()}`
      );
    }
    if (chunk.length < pageSizeLoad) break;
    from += pageSizeLoad;
  }

  return { existingKeys, existingCaseClient };
}

export function planCaseImport(
  items: Array<Record<string, unknown>>,
  existing: ExistingKeySets,
  managementNumber?: string
): CaseImportPlan {
  const rows: CaseImportPlanRow[] = [];
  const toInsert: CaseDbInsertRow[] = [];
  const newKeys = new Set<string>();
  const newCaseClient = new Set<string>();

  let insert = 0;
  let duplicateDb = 0;
  let duplicateBatch = 0;
  let invalid = 0;

  items.forEach((raw, index) => {
    const excelRow = Number(raw._excelRow ?? index + 2);
    const dbRow = caseItemToDbRow(raw, managementNumber);
    const display = {
      caseNumber: dbRow.case_number,
      clientName: dbRow.client_name,
      caseName: dbRow.case_name,
      court: dbRow.court,
      assignedStaff: dbRow.assigned_staff_name,
    };

    if (!String(raw.caseNumber ?? raw.case_number ?? "").trim() && dbRow.case_number === "미등록") {
      invalid += 1;
      rows.push({
        excelRow,
        ...display,
        status: "invalid",
        reason: "사건번호가 없습니다.",
        item: null,
      });
      return;
    }

    const ccKey = `${dbRow.case_number}|${dbRow.client_name}`;
    const fullKey = JSON.stringify(dbRow);

    if (existing.existingCaseClient.has(ccKey)) {
      duplicateDb += 1;
      rows.push({
        excelRow,
        ...display,
        status: "duplicate_db",
        reason: "DB에 동일 사건번호·의뢰인이 이미 있습니다.",
        item: null,
      });
      return;
    }
    if (existing.existingKeys.has(fullKey)) {
      duplicateDb += 1;
      rows.push({
        excelRow,
        ...display,
        status: "duplicate_db",
        reason: "DB에 동일 내용의 사건이 이미 있습니다.",
        item: null,
      });
      return;
    }
    if (newCaseClient.has(ccKey)) {
      duplicateBatch += 1;
      rows.push({
        excelRow,
        ...display,
        status: "duplicate_batch",
        reason: "엑셀 파일 내 동일 사건번호·의뢰인 중복 행입니다.",
        item: null,
      });
      return;
    }
    if (newKeys.has(fullKey)) {
      duplicateBatch += 1;
      rows.push({
        excelRow,
        ...display,
        status: "duplicate_batch",
        reason: "엑셀 파일 내 완전 동일 행입니다.",
        item: null,
      });
      return;
    }

    newKeys.add(fullKey);
    newCaseClient.add(ccKey);
    insert += 1;
    const { _excelRow: _, ...item } = raw;
    rows.push({
      excelRow,
      ...display,
      status: "insert",
      reason: "신규 등록 예정",
      item,
    });
    toInsert.push(dbRow);
  });

  return {
    rows,
    toInsert,
    summary: {
      total: rows.length,
      insert,
      duplicateDb,
      duplicateBatch,
      invalid,
    },
  };
}

export async function insertCaseImportRows(
  db: SupabaseClient,
  toInsert: CaseDbInsertRow[],
  rawItems?: Array<Record<string, unknown>>,
  request?: NextRequest,
  managementNumber?: string
): Promise<number> {
  const session = await resolveAuditActor(null);
  const defaultRegistrar = session?.name ?? session?.loginId ?? "";
  const mgmt = managementNumber?.trim();
  for (let i = 0; i < toInsert.length; i++) {
    if (mgmt && !toInsert[i].management_number?.trim()) {
      toInsert[i].management_number = mgmt;
    }
    if (!toInsert[i].created_by_name?.trim()) {
      const rawName = String(rawItems?.[i]?.createdByName ?? rawItems?.[i]?.created_by_name ?? "").trim();
      toInsert[i].created_by_name = rawName || defaultRegistrar || null;
    }
    if (!toInsert[i].registered_date?.trim()) {
      const rawReg = rawItems?.[i]?.registeredDate ?? rawItems?.[i]?.registered_date;
      if (rawReg) toInsert[i].registered_date = toDateString(rawReg);
    }
  }

  const chunkSize = 100;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const chunkRaw = rawItems?.slice(i, i + chunkSize);
    const { data, error } = await db.from("cases").insert(chunk).select("id, case_number, client_name");
    if (error) throw new Error(error.message);
    inserted += chunk.length;

    if (!data?.length || !chunkRaw?.length) continue;

    const institutionRows: Record<string, unknown>[] = [];
    const casePatches: Array<{ caseId: string; patch: Record<string, unknown> }> = [];
    const followUps: Array<() => Promise<void>> = [];

    for (let j = 0; j < data.length; j++) {
      const caseId = String((data[j] as Record<string, unknown>).id ?? "");
      const raw = chunkRaw[j];
      const insertedRow = data[j] as Record<string, unknown>;
      if (!caseId || !raw) continue;

      const inst = buildInstitutionFromImport(raw);
      if (inst) {
        institutionRows.push(institutionToRow(caseId, inst));
        const trialLevel = String(raw.trialLevel ?? raw.trial_level ?? "1심");
        const activeStage = trialLevelToCourtStage(trialLevel);
        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          active_stage: activeStage,
        };
        const resolved = resolveActiveCourtFromInstitutions([inst], activeStage);
        if (resolved?.court) patch.court = resolved.court;
        if (resolved?.caseNumber) patch.case_number = resolved.caseNumber;
        casePatches.push({ caseId, patch });
      }

      const partySeed = buildPartiesFromImport(raw);
      if (partySeed.length > 0) {
        followUps.push(async () => {
          await upsertCaseParties(db, caseId, partySeed, {
            skipCaseSync: true,
            skipReload: true,
          });
        });
      }

      followUps.push(async () => {
        await insertCaseAuditLog(db, {
          caseId,
          caseNumber: String(insertedRow.case_number ?? raw.caseNumber ?? ""),
          clientName: String(insertedRow.client_name ?? raw.clientName ?? ""),
          action: "bulk_import",
          summary: "엑셀 일괄 등록",
          request,
          session,
        });
      });
    }

    if (institutionRows.length > 0) {
      const { error: instErr } = await db
        .from("case_institutions")
        .upsert(institutionRows, { onConflict: "case_id,stage" });
      if (instErr) throw new Error(instErr.message);
    }

    if (casePatches.length > 0) {
      await Promise.all(
        casePatches.map(({ caseId, patch }) =>
          db.from("cases").update(patch).eq("id", caseId)
        )
      );
    }

    const concurrency = 8;
    for (let k = 0; k < followUps.length; k += concurrency) {
      await Promise.all(followUps.slice(k, k + concurrency).map((fn) => fn()));
    }
  }
  return inserted;
}
