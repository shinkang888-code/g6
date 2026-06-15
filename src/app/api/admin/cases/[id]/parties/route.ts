import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { loadCaseParties, upsertCaseParties } from "@/lib/casePartyApi";
import { fetchCaseSnapshot, insertCaseAuditLog } from "@/lib/caseAuditLog";
import type { CasePartyInput, CasePartyRole } from "@/lib/casePartyTypes";
import { assertCaseInTenant, requireTenantSession } from "@/lib/tenantScope";
import { maskPartiesList, shouldMaskTrialNames } from "@/lib/trialNameMask";

function getDb() {
  return getSupabaseAdmin();
}

function parsePartyInput(raw: Record<string, unknown>): CasePartyInput | null {
  const role = String(raw.role ?? "").trim() as CasePartyRole;
  const name = String(raw.name ?? "").trim();
  if (!role || !name) return null;
  return {
    id: raw.id ? String(raw.id) : undefined,
    role,
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0),
    clientId: raw.clientId ? String(raw.clientId) : undefined,
    name,
    position: String(raw.position ?? ""),
    isCorporate: Boolean(raw.isCorporate ?? raw.is_corporate),
    phone: String(raw.phone ?? ""),
    mobile: String(raw.mobile ?? ""),
    fax: String(raw.fax ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    idNumber: String(raw.idNumber ?? raw.id_number ?? ""),
    bizNumber: String(raw.bizNumber ?? raw.biz_number ?? ""),
    ...(raw.clientMemo !== undefined || raw.client_memo !== undefined
      ? { clientMemo: String(raw.clientMemo ?? raw.client_memo ?? "") }
      : {}),
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
    const data = await loadCaseParties(db, id, { seedFromCase: true });
    return NextResponse.json({ data: maskNames ? maskPartiesList(data) : data });
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

  let body: { parties?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parties = (body.parties ?? [])
    .map(parsePartyInput)
    .filter((x): x is CasePartyInput => x !== null);

  try {
    const snapshot = await fetchCaseSnapshot(db, id);
    const data = await upsertCaseParties(db, id, parties);
    const clientCount = parties.filter((p) => p.role === "client").length;
    const opponentCount = parties.filter((p) => p.role === "opponent").length;
    await insertCaseAuditLog(db, {
      caseId: id,
      caseNumber: String(snapshot?.case_number ?? ""),
      clientName: String(snapshot?.client_name ?? ""),
      action: "parties_update",
      summary: `당사자 저장 (의뢰인 ${clientCount}, 상대방 ${opponentCount})`,
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
