/**
 * 관리자 사건 API - 목록/생성/일괄 상태변경/일괄삭제
 * Supabase cases 테이블 연동
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import {
  caseItemToDbRow,
  insertCaseImportRows,
  loadExistingCaseKeySets,
  planCaseImport,
} from "@/lib/caseImportServer";
import { pickNextDeadline, type CaseDeadlineRow } from "@/lib/caseDeadlineMemoCore";
import { parseCaseStatusApiParam } from "@/lib/caseStatusFilter";
import { sortCasesByNextDeadline } from "@/lib/caseListSort";
import { clientSyncInputFromParty, upsertClientForCase } from "@/lib/caseClientSync";
import { upsertCaseInstitutions } from "@/lib/caseInstitutionApi";
import { upsertCaseParties } from "@/lib/casePartyApi";
import {
  summarizePartiesForCase,
  type CasePartyInput,
  type CasePartyRole,
} from "@/lib/casePartyTypes";
import type { CaseInstitutionInput, CaseInstitutionStage } from "@/lib/caseInstitutionTypes";
import { insertCaseAuditLog, resolveAuditActor } from "@/lib/caseAuditLog";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCaseSearchOrFilter,
  buildCaseStaffSearchOrFilter,
} from "@/lib/caseListFilters";
import {
  requireTenantSession,
  tenantRowFields,
} from "@/lib/tenantScope";
import { maskCaseFields, shouldMaskTrialNames } from "@/lib/trialNameMask";

function getDb() {
  return getSupabaseAdmin();
}

function toRow(item: Record<string, unknown>, managementNumber?: string) {
  return caseItemToDbRow(item, managementNumber);
}

function fromRow(r: Record<string, unknown>, maskNames = false) {
  const row = {
    id: r.id,
    caseNumber: r.case_number,
    caseType: r.case_type,
    caseName: r.case_name,
    court: r.court,
    clientName: r.client_name as string | null | undefined,
    clientPosition: r.client_position,
    opponentName: r.opponent_name as string | null | undefined,
    status: r.status,
    assignedStaff: r.assigned_staff_name,
    assistants: r.assistants ?? "",
    receivedDate: r.received_date,
    registeredDate:
      (r.registered_date as string | undefined) ??
      (r.created_at ? String(r.created_at).slice(0, 10) : ""),
    createdByName: (r.created_by_name as string | undefined) ?? "",
    nextDate: null as string | null,
    nextDateType: "" as string,
    amount: Number(r.amount ?? 0),
    receivedAmount: Number(r.received_amount ?? 0),
    pendingAmount: Number(r.pending_amount ?? 0),
    isElectronic: Boolean(r.is_electronic),
    isUrgent: Boolean(r.is_urgent),
    isImmutable: Boolean(r.is_immutable_deadline),
    notes: r.notes ?? "",
    courtDivision: (r.court_division as string | undefined) ?? "",
    trialLevel: (r.trial_level as string | undefined) ?? "",
    managementKey: (r.management_key as string | undefined) ?? "",
    activeStage: (r.active_stage as string | undefined) ?? "",
    clientId: r.client_id ? String(r.client_id) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return maskNames ? maskCaseFields(row) : row;
}

function parseInstitutionsFromBody(body: Record<string, unknown>): CaseInstitutionInput[] {
  const raw = body.institutions;
  if (!Array.isArray(raw)) return [];
  const out: CaseInstitutionInput[] = [];
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    const stage = String(r.stage ?? "").trim() as CaseInstitutionStage;
    if (!stage) continue;
    out.push({
      stage,
      sortOrder: Number(r.sortOrder ?? 0),
      agencyName: String(r.agencyName ?? ""),
      caseNumber: String(r.caseNumber ?? ""),
      caseName: String(r.caseName ?? ""),
      department: String(r.department ?? ""),
      contactName: String(r.contactName ?? ""),
      phone: String(r.phone ?? ""),
      mobile: String(r.mobile ?? ""),
      fax: String(r.fax ?? ""),
      email: String(r.email ?? ""),
      room: String(r.room ?? ""),
      notes: String(r.notes ?? ""),
      detentionAgency: String(r.detentionAgency ?? ""),
      detentionNumber: String(r.detentionNumber ?? ""),
    });
  }
  return out;
}

function parsePartiesFromBody(body: Record<string, unknown>): CasePartyInput[] {
  const raw = body.parties;
  if (!Array.isArray(raw)) return [];
  const out: CasePartyInput[] = [];
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    const role = String(r.role ?? "").trim() as CasePartyRole;
    const name = String(r.name ?? "").trim();
    if (!role || !name) continue;
    out.push({
      id: r.id ? String(r.id) : undefined,
      role,
      sortOrder: Number(r.sortOrder ?? 0),
      name,
      position: String(r.position ?? ""),
      isCorporate: Boolean(r.isCorporate),
      phone: String(r.phone ?? ""),
      mobile: String(r.mobile ?? ""),
      fax: String(r.fax ?? ""),
      email: String(r.email ?? ""),
      address: String(r.address ?? ""),
      idNumber: String(r.idNumber ?? ""),
      bizNumber: String(r.bizNumber ?? ""),
      ...(r.clientMemo !== undefined || r.client_memo !== undefined
        ? { clientMemo: String(r.clientMemo ?? r.client_memo ?? "") }
        : {}),
    });
  }
  return out;
}

type CaseListFilters = {
  idParam: string;
  q: string;
  status: string;
  caseType: string;
  court: string;
  assignedStaff: string;
  staffQ: string;
};

function applyCaseListFilters<T extends { eq: Function; or: Function; in: Function }>(
  query: T,
  filters: CaseListFilters
): T {
  let q = query;
  if (filters.idParam.trim()) {
    q = q.eq("id", filters.idParam.trim()) as T;
  }
  const textOr = buildCaseSearchOrFilter(filters.q);
  if (textOr) {
    q = q.or(textOr) as T;
  }
  const statusList = parseCaseStatusApiParam(filters.status);
  if (statusList?.length === 1) {
    q = q.eq("status", statusList[0]) as T;
  } else if (statusList && statusList.length > 1) {
    q = q.in("status", statusList) as T;
  }
  if (filters.caseType.trim()) q = q.eq("case_type", filters.caseType.trim()) as T;
  if (filters.court.trim()) q = q.eq("court", filters.court.trim()) as T;
  if (filters.assignedStaff.trim()) {
    q = q.eq("assigned_staff_name", filters.assignedStaff.trim()) as T;
  }
  const staffOr = buildCaseStaffSearchOrFilter(filters.staffQ);
  if (staffOr) {
    q = q.or(staffOr) as T;
  }
  return q;
}

async function buildNextDeadlineMap(
  db: SupabaseClient,
  caseIds: string[]
): Promise<Map<string, { date: string; type: string }>> {
  const nextByCaseId = new Map<string, { date: string; type: string }>();
  if (!caseIds.length) return nextByCaseId;

  const rowsByCase = new Map<string, CaseDeadlineRow[]>();
  const chunkSize = 200;
  for (let i = 0; i < caseIds.length; i += chunkSize) {
    const chunk = caseIds.slice(i, i + chunkSize);
    const { data: dlRows } = await db
      .from("deadlines")
      .select("case_id, deadline_date, deadline_type, memo")
      .in("case_id", chunk);
    for (const r of dlRows ?? []) {
      const cid = r.case_id as string;
      if (!rowsByCase.has(cid)) rowsByCase.set(cid, []);
      rowsByCase.get(cid)!.push({
        id: "",
        date: r.deadline_date as string,
        type: (r.deadline_type as string) ?? undefined,
        memo: (r.memo as string) ?? undefined,
      });
    }
  }

  for (const [cid, rows] of rowsByCase) {
    const picked = pickNextDeadline(rows);
    if (picked) {
      nextByCaseId.set(cid, {
        date: picked.date,
        type: picked.type?.trim() || "기일",
      });
    }
  }
  return nextByCaseId;
}

function attachNextDates(
  cases: Record<string, unknown>[],
  nextByCaseId: Map<string, { date: string; type: string }>,
  maskNames = false
) {
  return cases.map((r) => {
    const row = fromRow(r, maskNames);
    const next = nextByCaseId.get(row.id as string);
    return {
      ...row,
      nextDate: next?.date ?? null,
      nextDateType: next?.type ?? "",
    };
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;
  const maskNames = shouldMaskTrialNames(managementNumber, request);
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id") ?? "";
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const caseType = searchParams.get("case_type") ?? "";
  const court = searchParams.get("court") ?? "";
  const assignedStaff = searchParams.get("assigned_staff") ?? "";
  const staffQ = searchParams.get("staff_q") ?? "";
  const sortBy = searchParams.get("sort_by") ?? "next_deadline";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const sizeParam = Number(searchParams.get("page_size") ?? "15");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSizeRaw = Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : 15;
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const filters: CaseListFilters = {
    idParam,
    q,
    status,
    caseType,
    court,
    assignedStaff,
    staffQ,
  };

  if (sortBy === "next_deadline") {
    let allQuery = applyCaseListFilters(db.from("cases").select("*"), filters).eq(
      "management_number",
      managementNumber
    );
    const { data: allRows, error: allErr } = await allQuery;
    if (allErr) {
      return NextResponse.json({ error: allErr.message }, { status: 400 });
    }
    const cases = (allRows ?? []) as Record<string, unknown>[];
    const caseIds = cases.map((c) => c.id as string).filter(Boolean);
    const nextByCaseId = await buildNextDeadlineMap(db, caseIds);
    const withNext = attachNextDates(cases, nextByCaseId, maskNames);
    const sorted = sortCasesByNextDeadline(
      withNext as Array<{
        nextDate: string | null;
        createdAt?: string;
        caseNumber?: string;
      }>
    );
    const pageSlice = sorted.slice(from, to + 1);
    return NextResponse.json({
      data: pageSlice,
      total: sorted.length,
      page,
      pageSize,
      sortBy: "next_deadline",
    });
  }

  let query = applyCaseListFilters(
    db.from("cases").select("*", { count: "exact" }),
    filters
  )
    .eq("management_number", managementNumber)
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const cases = (data ?? []) as Record<string, unknown>[];
  const caseIds = cases.map((c) => c.id as string).filter(Boolean);
  const nextByCaseId = await buildNextDeadlineMap(db, caseIds);
  const out = attachNextDates(cases, nextByCaseId, maskNames);
  return NextResponse.json({
    data: out,
    total: typeof count === "number" ? count : out.length,
    page,
    pageSize,
    sortBy: "created_at",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;
  let body: Record<string, unknown> | { items?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (Array.isArray(body.items) && body.items.length > 0) {
    try {
      const existing = await loadExistingCaseKeySets(db, managementNumber);
      const plan = planCaseImport(body.items, existing, managementNumber);
      const rawItems = plan.rows
        .filter((r) => r.status === "insert" && r.item)
        .map((r) => r.item as Record<string, unknown>);
      const inserted = await insertCaseImportRows(
        db,
        plan.toInsert,
        rawItems,
        request,
        managementNumber
      );

      const messages: string[] = [];
      messages.push(`${inserted}건 신규 사건이 등록되었습니다.`);
      if (plan.summary.duplicateDb > 0) {
        messages.push(`DB 중복 사건 ${plan.summary.duplicateDb}건은 제외했습니다.`);
      }
      if (plan.summary.duplicateBatch > 0) {
        messages.push(`엑셀 내 중복 ${plan.summary.duplicateBatch}건은 1건만 등록하고 나머지는 제외했습니다.`);
      }

      return NextResponse.json({
        message: messages.join(" "),
        inserted,
        skippedExisting: plan.summary.duplicateDb,
        skippedInBatch: plan.summary.duplicateBatch,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "등록 실패" },
        { status: 400 }
      );
    }
  }

  const bodyRec = body as Record<string, unknown>;
  const row = toRow(bodyRec, managementNumber) as Record<string, unknown>;
  Object.assign(row, tenantRowFields(managementNumber));
  const session = await resolveAuditActor(null);
  const registrar =
    String(bodyRec.createdByName ?? bodyRec.created_by_name ?? "").trim() ||
    session?.name ||
    session?.loginId ||
    "";
  if (registrar) row.created_by_name = registrar;
  const regDate = String(bodyRec.registeredDate ?? bodyRec.registered_date ?? "").trim();
  row.registered_date = regDate || new Date().toISOString().slice(0, 10);

  const parties = parsePartiesFromBody(bodyRec);

  if (parties.length > 0) {
    const summary = summarizePartiesForCase(parties);
    row.client_name = summary.clientName;
    row.client_position = summary.clientPosition || null;
    row.opponent_name = summary.opponentName || null;
  }

  const clientName = String(row.client_name ?? bodyRec.clientName ?? "").trim();
  if (clientName && clientName !== "(의뢰인 없음)") {
    try {
      const primary = parties.find((p) => p.role === "client" && p.sortOrder === 0);
      const clientId = await upsertClientForCase(
        db,
        primary
          ? clientSyncInputFromParty(primary)
          : {
              name: clientName,
              phone: String(bodyRec.clientPhone ?? ""),
              mobile: String(bodyRec.clientMobile ?? ""),
              address: String(bodyRec.clientAddress ?? ""),
              position: String(bodyRec.clientPosition ?? ""),
              idNumber: String(bodyRec.clientIdNumber ?? ""),
              bizNumber: String(bodyRec.clientBizNumber ?? ""),
            },
        managementNumber
      );
      if (clientId) row.client_id = clientId;
    } catch {
      // clients 연동 실패해도 사건 등록은 진행
    }
  }

  const { data, error } = await db
    .from("cases")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const caseId = String((data as Record<string, unknown>).id ?? "");
  const institutions = parseInstitutionsFromBody(bodyRec);
  const activeStage = String(bodyRec.activeStage ?? "").trim() as CaseInstitutionStage;
  if (caseId && institutions.length > 0) {
    try {
      await upsertCaseInstitutions(db, caseId, institutions, {
        activeStage: activeStage || null,
      });
    } catch {
      // institution 저장 실패 시 사건은 유지
    }
  }

  if (caseId && parties.length > 0) {
    try {
      await upsertCaseParties(db, caseId, parties);
    } catch {
      // party 저장 실패 시 사건은 유지
    }
  }

  const created = data as Record<string, unknown>;
  await insertCaseAuditLog(db, {
    caseId,
    caseNumber: String(created.case_number ?? ""),
    clientName: String(created.client_name ?? ""),
    action: "create",
    summary: "신규 사건 등록",
    request,
  });

  return NextResponse.json({ data: fromRow(created) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;
  let body: { ids?: string[]; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const ids = body.ids ?? [];
  const status = body.status ?? "종결";
  if (ids.length === 0) {
    return NextResponse.json({ error: "대상 사건을 선택하세요." }, { status: 400 });
  }
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "종결") {
    update.closed_at = new Date().toISOString().slice(0, 10);
    update.closed_type = "일괄종결";
  }
  const { data: targets } = await db
    .from("cases")
    .select("id, case_number, client_name")
    .eq("management_number", managementNumber)
    .in("id", ids);

  const { error } = await db
    .from("cases")
    .update(update)
    .eq("management_number", managementNumber)
    .in("id", ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  for (const row of targets ?? []) {
    const r = row as Record<string, unknown>;
    await insertCaseAuditLog(db, {
      caseId: String(r.id ?? ""),
      caseNumber: String(r.case_number ?? ""),
      clientName: String(r.client_name ?? ""),
      action: "bulk_status",
      summary: `진행상태 → ${status}`,
      changes: { status: { from: null, to: status } },
      request,
    });
  }

  return NextResponse.json({ message: `${ids.length}건이 ${status}(으)로 변경되었습니다.` });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;
  let body: { ids?: string[]; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 전체 삭제 모드
  if (body.all) {
    let totalDeleted = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await db
        .from("cases")
        .select("id, case_number, client_name")
        .eq("management_number", managementNumber)
        .range(0, pageSize - 1);
      if (error) {
        return NextResponse.json({ error: error.message, deleted: totalDeleted }, { status: 400 });
      }
      const rows = data ?? [];
      const idsChunk = rows.map((r) => r.id as string).filter(Boolean);
      if (idsChunk.length === 0) break;
      const { error: delError } = await db
        .from("cases")
        .delete()
        .eq("management_number", managementNumber)
        .in("id", idsChunk);
      if (delError) {
        return NextResponse.json({ error: delError.message, deleted: totalDeleted }, { status: 400 });
      }
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        await insertCaseAuditLog(db, {
          caseId: String(r.id ?? ""),
          caseNumber: String(r.case_number ?? ""),
          clientName: String(r.client_name ?? ""),
          action: "delete",
          summary: "전체 삭제 작업",
          request,
        });
      }
      totalDeleted += idsChunk.length;
      if (idsChunk.length < pageSize) break;
    }
    return NextResponse.json({ message: `전체 사건 ${totalDeleted}건을 삭제했습니다.`, deleted: totalDeleted });
  }

  // 선택 삭제 모드
  const ids = body.ids ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "삭제할 사건을 선택하세요." }, { status: 400 });
  }

  const { data: toDelete } = await db
    .from("cases")
    .select("id, case_number, client_name")
    .eq("management_number", managementNumber)
    .in("id", ids);

  const { error } = await db
    .from("cases")
    .delete()
    .eq("management_number", managementNumber)
    .in("id", ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  for (const row of toDelete ?? []) {
    const r = row as Record<string, unknown>;
    await insertCaseAuditLog(db, {
      caseId: String(r.id ?? ""),
      caseNumber: String(r.case_number ?? ""),
      clientName: String(r.client_name ?? ""),
      action: "delete",
      summary: "사건 삭제",
      request,
    });
  }
  return NextResponse.json({ message: `${ids.length}건이 삭제되었습니다.` });
}
