/**
 * GET   /api/mail/[id] — 메일 상세 (읽음 처리)
 * PATCH /api/mail/[id] — 읽음 상태 변경
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenantScope";
import { getMailMessage, markMailRead } from "@/lib/mailService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  try {
    const message = await getMailMessage(id);
    if (!message) {
      return NextResponse.json({ success: false, error: "메일을 찾을 수 없습니다." }, { status: 404 });
    }
    await markMailRead(id);
    return NextResponse.json({ success: true, message: { ...message, isRead: true } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "메일을 불러올 수 없습니다.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(_request: NextRequest, { params }: Params) {
  const auth = await requireTenantSession();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const ok = await markMailRead(id);
  if (!ok) {
    return NextResponse.json({ success: false, error: "읽음 처리에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
