/**
 * 고객 연관 사건 목록 (LawTop 고객↔사건 연동)
 */

import { NextRequest, NextResponse } from "next/server";
import { applyTenantFilter, assertClientInTenant, requireTenantSession } from "@/lib/tenantScope";
import { maskPersonName, shouldMaskTrialNames } from "@/lib/trialNameMask";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;
  const maskNames = shouldMaskTrialNames(managementNumber, request);

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "고객 id 필요" }, { status: 400 });
  }

  const inTenant = await assertClientInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ data: [] });
  }

  const { data: client, error: clientErr } = await applyTenantFilter(
    db.from("clients").select("id, name"),
    managementNumber
  )
    .eq("id", id)
    .maybeSingle();

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 400 });
  }
  if (!client) {
    return NextResponse.json({ data: [] });
  }

  const name = String(client.name ?? "").trim();

  const { data: byId, error: byIdErr } = await applyTenantFilter(
    db
      .from("cases")
      .select("id, case_number, case_name, status, court, assigned_staff_name, received_date"),
    managementNumber
  )
    .eq("client_id", id)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (byIdErr) {
    return NextResponse.json({ error: byIdErr.message }, { status: 400 });
  }

  let data = byId ?? [];
  if (data.length === 0 && name) {
    const { data: byName, error } = await applyTenantFilter(
      db
        .from("cases")
        .select("id, case_number, case_name, status, court, assigned_staff_name, received_date"),
      managementNumber
    )
      .eq("client_name", name)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    data = byName ?? [];
  }

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    caseNumber: r.case_number,
    caseName: r.case_name,
    status: r.status,
    court: r.court,
    assignedStaff: r.assigned_staff_name,
    receivedDate: r.received_date,
  }));

  return NextResponse.json({
    data: rows,
    clientName: maskNames ? maskPersonName(name) : name,
  });
}
