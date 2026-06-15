import { NextRequest, NextResponse } from "next/server";
import {
  diffCaseRows,
  fetchCaseSnapshot,
  insertCaseAuditLog,
} from "@/lib/caseAuditLog";
import { assertCaseInTenant, requireTenantSession } from "@/lib/tenantScope";

function fromRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    caseNumber: r.case_number,
    caseType: r.case_type,
    caseName: r.case_name,
    court: r.court,
    clientName: r.client_name,
    clientPosition: r.client_position,
    opponentName: r.opponent_name,
    status: r.status,
    assignedStaff: r.assigned_staff_name,
    assistants: r.assistants ?? "",
    receivedDate: r.received_date,
    registeredDate:
      (r.registered_date as string | undefined) ??
      (r.created_at ? String(r.created_at).slice(0, 10) : ""),
    createdByName: (r.created_by_name as string | undefined) ?? "",
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
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "사건 ID가 필요합니다." }, { status: 400 });
  }

  const inTenant = await assertCaseInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "사건을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const before = await fetchCaseSnapshot(db, id);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.caseNumber !== undefined) update.case_number = String(body.caseNumber).trim();
  if (body.caseType !== undefined) update.case_type = String(body.caseType).trim();
  if (body.caseName !== undefined) update.case_name = String(body.caseName).trim();
  if (body.court !== undefined) update.court = String(body.court).trim();
  if (body.clientName !== undefined) update.client_name = String(body.clientName).trim();
  if (body.clientPosition !== undefined) update.client_position = body.clientPosition;
  if (body.opponentName !== undefined) update.opponent_name = body.opponentName;
  if (body.assignedStaff !== undefined) update.assigned_staff_name = String(body.assignedStaff).trim();
  if (body.assistants !== undefined) update.assistants = body.assistants;
  if (body.status !== undefined) update.status = body.status;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.isElectronic !== undefined) update.is_electronic = Boolean(body.isElectronic);
  if (body.receivedDate !== undefined) update.received_date = body.receivedDate;
  if (body.amount !== undefined) update.amount = Number(body.amount) || 0;
  if (body.courtDivision !== undefined) update.court_division = body.courtDivision;
  if (body.trialLevel !== undefined) update.trial_level = body.trialLevel;
  if (body.managementKey !== undefined) update.management_key = body.managementKey;
  if (body.activeStage !== undefined) update.active_stage = body.activeStage;

  const { data, error } = await db
    .from("cases")
    .update(update)
    .eq("id", id)
    .eq("management_number", managementNumber)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const after = data as Record<string, unknown>;
  if (before) {
    const changes = diffCaseRows(before, after, Object.keys(update).filter((k) => k !== "updated_at"));
    await insertCaseAuditLog(db, {
      caseId: id,
      caseNumber: String(after.case_number ?? before.case_number ?? ""),
      clientName: String(after.client_name ?? before.client_name ?? ""),
      action: "update",
      changes,
      request,
    });
  }

  return NextResponse.json({ data: fromRow(after) });
}
