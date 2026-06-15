import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import {
  institutionFromRow,
  loadCaseInstitutions,
  upsertCaseInstitutions,
} from "@/lib/caseInstitutionApi";
import type { CaseInstitutionInput, CaseInstitutionStage } from "@/lib/caseInstitutionTypes";
import { fetchCaseSnapshot, insertCaseAuditLog } from "@/lib/caseAuditLog";
import { assertCaseInTenant, requireTenantSession } from "@/lib/tenantScope";
import { maskInstitutionsList, shouldMaskTrialNames } from "@/lib/trialNameMask";

function getDb() {
  return getSupabaseAdmin();
}

function parseInstitutionInput(raw: Record<string, unknown>): CaseInstitutionInput | null {
  const stage = String(raw.stage ?? "").trim() as CaseInstitutionStage;
  if (!stage) return null;
  return {
    stage,
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0),
    agencyName: String(raw.agencyName ?? raw.agency_name ?? ""),
    caseNumber: String(raw.caseNumber ?? raw.case_number ?? ""),
    caseName: String(raw.caseName ?? raw.case_name ?? ""),
    department: String(raw.department ?? ""),
    contactName: String(raw.contactName ?? raw.contact_name ?? ""),
    phone: String(raw.phone ?? ""),
    mobile: String(raw.mobile ?? ""),
    fax: String(raw.fax ?? ""),
    email: String(raw.email ?? ""),
    room: String(raw.room ?? ""),
    notes: String(raw.notes ?? ""),
    detentionAgency: String(raw.detentionAgency ?? raw.detention_agency ?? ""),
    detentionNumber: String(raw.detentionNumber ?? raw.detention_number ?? ""),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenantSession();
  if ("error" in tenant) return tenant.error;
  const { db, managementNumber } = tenant;
  const maskNames = shouldMaskTrialNames(managementNumber, request);

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "사건 ID가 필요합니다." }, { status: 400 });
  }
  if (!(await assertCaseInTenant(db, id, managementNumber))) {
    return NextResponse.json({ error: "해당 사건에 접근할 수 없습니다." }, { status: 403 });
  }
  try {
    const data = await loadCaseInstitutions(db, id);
    return NextResponse.json({ data: maskNames ? maskInstitutionsList(data) : data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenantSession();
  if ("error" in tenant) return tenant.error;
  const { db, managementNumber } = tenant;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "사건 ID가 필요합니다." }, { status: 400 });
  }
  if (!(await assertCaseInTenant(db, id, managementNumber))) {
    return NextResponse.json({ error: "해당 사건에 접근할 수 없습니다." }, { status: 403 });
  }

  let body: { institutions?: Record<string, unknown>[]; activeStage?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const institutions = (body.institutions ?? [])
    .map(parseInstitutionInput)
    .filter((x): x is CaseInstitutionInput => x !== null);

  try {
    const snapshot = await fetchCaseSnapshot(db, id);
    const data = await upsertCaseInstitutions(db, id, institutions, {
      activeStage: (body.activeStage as CaseInstitutionStage) || null,
    });
    await insertCaseAuditLog(db, {
      caseId: id,
      caseNumber: String(snapshot?.case_number ?? ""),
      clientName: String(snapshot?.client_name ?? ""),
      action: "institutions_update",
      summary: `계속기관 ${institutions.length}건 저장 (현재: ${body.activeStage ?? "-"})`,
      request,
    });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 400 }
    );
  }
}
