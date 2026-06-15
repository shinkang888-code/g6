import { NextRequest, NextResponse } from "next/server";
import {
  softDeleteConsultationRoom,
  updateConsultationRoom,
} from "@/lib/consultationService";
import { requireAuthenticatedSession } from "@/lib/adminSession";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const updated = await updateConsultationRoom(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: "상담실을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "수정 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const ok = await softDeleteConsultationRoom(id);
    if (!ok) {
      return NextResponse.json({ success: false, error: "상담실을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 500 }
    );
  }
}
