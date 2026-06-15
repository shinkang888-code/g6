/**
 * 고객(의뢰인) CRUD — LawTop guestlist 연동
 * GET ?q=&include_deleted=&page=&page_size=
 * PATCH { id, restore: true } — 복구
 * DELETE — soft delete (deleted_at)
 */

import { NextRequest, NextResponse } from "next/server";
import { clientFromRow, clientToRow } from "@/lib/clientApi";
import {
  applyTenantFilter,
  assertClientInTenant,
  requireTenantSession,
  tenantRowFields,
} from "@/lib/tenantScope";
import { maskClientsList, shouldMaskTrialNames } from "@/lib/trialNameMask";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;
  const maskNames = shouldMaskTrialNames(managementNumber, request);

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const includeDeleted = sp.get("include_deleted") === "true";
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size") ?? "500")));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = applyTenantFilter(
    db.from("clients").select("*", { count: "exact" }),
    managementNumber
  ).order("updated_at", { ascending: false });

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,contact_phone.ilike.%${q}%,contact_mobile.ilike.%${q}%,contact_email.ilike.%${q}%,address.ilike.%${q}%,memo.ilike.%${q}%,guest_code.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = (data ?? []).map((r) => clientFromRow(r as Record<string, unknown>));
  const out = maskNames ? maskClientsList(list) : list;
  return NextResponse.json({
    data: out,
    total: typeof count === "number" ? count : out.length,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const row = clientToRow(body, managementNumber);
  if (!row) {
    return NextResponse.json({ error: "의뢰인 이름을 입력하세요." }, { status: 400 });
  }
  Object.assign(row, tenantRowFields(managementNumber));

  const { data, error } = await db.from("clients").insert(row).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data: clientFromRow(data as Record<string, unknown>) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, session, managementNumber } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "고객 id가 필요합니다." }, { status: 400 });
  }

  const inTenant = await assertClientInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "고객을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  if (body.restore === true) {
    if (session.role !== "관리자") {
      return NextResponse.json({ error: "복구는 관리자만 가능합니다." }, { status: 403 });
    }
    const { data, error } = await applyTenantFilter(
      db.from("clients").update({ deleted_at: null, updated_at: new Date().toISOString() }),
      managementNumber
    )
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: clientFromRow(data as Record<string, unknown>) });
  }

  const row = clientToRow(body, managementNumber);
  if (!row) {
    return NextResponse.json({ error: "의뢰인 이름을 입력하세요." }, { status: 400 });
  }
  delete row.management_number;

  const { data, error } = await applyTenantFilter(db.from("clients").update(row), managementNumber)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data: clientFromRow(data as Record<string, unknown>) });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "고객 id가 필요합니다." }, { status: 400 });
  }

  const inTenant = await assertClientInTenant(db, id, managementNumber);
  if (!inTenant) {
    return NextResponse.json({ error: "고객을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 404 });
  }

  const { error } = await applyTenantFilter(
    db.from("clients").update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    managementNumber
  ).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
