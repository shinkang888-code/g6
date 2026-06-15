import { NextRequest, NextResponse } from "next/server";
import {
  createConsultationRoom,
  listConsultationRooms,
} from "@/lib/consultationService";
import { requireAuthenticatedSession } from "@/lib/adminSession";

export async function GET() {
  try {
    const items = await listConsultationRooms();
    return NextResponse.json({ success: true, data: items, total: items.length });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "목록 조회 실패" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as { name?: string; sortOrder?: number; remarks?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: "상담실 이름을 입력하세요." }, { status: 400 });
    }
    const created = await createConsultationRoom(body);
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "등록 실패" },
      { status: 500 }
    );
  }
}
