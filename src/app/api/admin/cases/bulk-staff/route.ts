/**
 * 사건 담당/보조 일괄변경 (LawTop 사건담당·주담당 일괄변경 MVP)
 * PATCH { ids, role, action, personName, dryRun? }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  planBulkStaffChange,
  type BulkStaffAction,
  type BulkStaffRole,
} from "@/lib/bulkStaffCore";
import { applyTenantFilter, requireTenantSession } from "@/lib/tenantScope";

type RequestBody = {
  ids?: string[];
  role?: BulkStaffRole;
  action?: BulkStaffAction;
  personName?: string;
  dryRun?: boolean;
};

function parseBody(body: RequestBody) {
  const ids = (body.ids ?? []).map((id) => String(id).trim()).filter(Boolean);
  const role = body.role;
  const action = body.action;
  const personName = String(body.personName ?? "").trim();
  const dryRun = body.dryRun !== false;

  if (ids.length === 0) {
    return { error: "대상 사건을 선택하세요." };
  }
  if (!personName) {
    return { error: "대상 인물을 선택하세요." };
  }
  if (!action || !["교체", "IN", "OUT", "주담당"].includes(action)) {
    return { error: "동작(action)을 지정하세요." };
  }
  if (action !== "주담당" && (!role || !["수행", "보조"].includes(role))) {
    return { error: "역할(role)을 지정하세요. (수행/보조)" };
  }
  if (action === "교체" && role !== "수행") {
    return { error: "담당 교체는 수행 역할만 가능합니다." };
  }
  if ((action === "IN" || action === "OUT") && role !== "보조") {
    return { error: "보조 IN/OUT은 보조 역할만 가능합니다." };
  }

  return {
    ids,
    role: (role ?? "수행") as BulkStaffRole,
    action,
    personName,
    dryRun,
  };
}

export async function PATCH(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { session, db, managementNumber } = auth;

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { ids, role, action, personName, dryRun } = parsed;

  const { data, error } = await applyTenantFilter(
    db.from("cases").select("id, case_number, case_name, client_name, assigned_staff_name, assistants"),
    managementNumber
  ).in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const foundIds = new Set((data ?? []).map((r) => String(r.id)));
  const missing = ids.filter((id) => !foundIds.has(id));

  const cases = (data ?? []).map((r) => ({
    id: String(r.id),
    caseNumber: String(r.case_number ?? ""),
    caseName: String(r.case_name ?? ""),
    clientName: String(r.client_name ?? ""),
    assignedStaff: String(r.assigned_staff_name ?? ""),
    assistants: String(r.assistants ?? ""),
  }));

  const plan = planBulkStaffChange(cases, { role, action, personName });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      plan,
      missingIds: missing,
      operator: session.name || session.loginId,
    });
  }

  if (plan.summary.apply === 0) {
    return NextResponse.json(
      { error: "적용할 사건이 없습니다.", plan, missingIds: missing },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  let applied = 0;
  const failures: string[] = [];

  for (const u of plan.updates) {
    const { error: upErr } = await applyTenantFilter(
      db.from("cases").update({
        assigned_staff_name: u.assigned_staff_name,
        assistants: u.assistants,
        updated_at: now,
      }),
      managementNumber
    ).eq("id", u.id);
    if (upErr) {
      failures.push(`${u.id}: ${upErr.message}`);
    } else {
      applied += 1;
    }
  }

  if (failures.length > 0 && applied === 0) {
    return NextResponse.json({ error: failures.join("; ") }, { status: 500 });
  }

  return NextResponse.json({
    dryRun: false,
    message: `${applied}건 담당 정보가 변경되었습니다.`,
    applied,
    skipped: plan.summary.skip,
    errors: plan.summary.error,
    failures,
    plan,
    missingIds: missing,
    operator: session.name || session.loginId,
  });
}
