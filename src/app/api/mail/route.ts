/**
 * GET  /api/mail — 메일함 목록
 * POST /api/mail — 메일 작성(초안/수신 기록)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { createMailMessage, listMailMessages } from "@/lib/mailService";

export async function GET(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const direction = request.nextUrl.searchParams.get("direction");
  try {
    const messages = await listMailMessages({
      direction: direction === "outbound" ? "outbound" : direction === "inbound" ? "inbound" : undefined,
      managementNumber: auth.managementNumber,
    });
    return NextResponse.json({ success: true, messages, managementNumber: auth.managementNumber });
  } catch (e) {
    const message = e instanceof Error ? e.message : "메일 목록을 불러올 수 없습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  let body: {
    direction?: string;
    fromAddress?: string;
    toAddress?: string;
    subject?: string;
    bodyText?: string;
    caseId?: string;
    clientId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const direction = body.direction === "outbound" ? "outbound" : "inbound";
  const fromAddress = (body.fromAddress ?? "").trim();
  const toAddress = (body.toAddress ?? "").trim();
  const subject = (body.subject ?? "").trim();

  if (!fromAddress || !toAddress || !subject) {
    return NextResponse.json(
      { success: false, error: "보낸 사람, 받는 사람, 제목을 입력하세요." },
      { status: 400 }
    );
  }

  try {
    const message = await createMailMessage({
      direction,
      fromAddress,
      toAddress,
      subject,
      bodyText: body.bodyText,
      managementNumber: auth.managementNumber,
      caseId: body.caseId,
      clientId: body.clientId,
    });
    return NextResponse.json({
      success: true,
      message,
      hint: "실제 SMTP/IMAP 연동은 Phase 4 후속 작업입니다.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "메일 저장에 실패했습니다.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
