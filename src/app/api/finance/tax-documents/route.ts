/**
 * GET  /api/finance/tax-documents — 세금·현금영수증 이력
 * POST /api/finance/tax-documents — 발행 요청(초안) 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession, tenantRowFields } from "@/lib/tenantScope";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  const caseId = request.nextUrl.searchParams.get("caseId")?.trim();
  let query = db
    .from("tax_documents")
    .select("*")
    .eq("management_number", managementNumber)
    .order("created_at", { ascending: false })
    .limit(100);

  if (caseId) query = query.eq("case_id", caseId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [], managementNumber });
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;
  const { db, managementNumber } = auth;

  let body: {
    docType?: string;
    amount?: number;
    financeEntryId?: string;
    caseId?: string;
    clientName?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const docType = (body.docType ?? "세금계산서").trim();
  if (docType !== "세금계산서" && docType !== "현금영수증") {
    return NextResponse.json({ error: "유효하지 않은 증빙 유형입니다." }, { status: 400 });
  }

  const amount = Number(body.amount ?? 0);
  if (amount <= 0) {
    return NextResponse.json({ error: "금액을 입력하세요." }, { status: 400 });
  }

  const { data, error } = await db
    .from("tax_documents")
    .insert({
      doc_type: docType,
      amount,
      finance_entry_id: body.financeEntryId?.trim() || null,
      case_id: body.caseId?.trim() || null,
      client_name: (body.clientName ?? "").trim() || null,
      notes: (body.notes ?? "").trim() || null,
      status: "draft",
      ...tenantRowFields(managementNumber),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    document: data,
    message: "발행 초안이 등록되었습니다. 홈택스·팝빌 등 외부 연동은 Phase 4 후속 작업입니다.",
  });
}
