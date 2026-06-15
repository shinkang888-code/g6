import { NextRequest, NextResponse } from "next/server";
import {
  createConsultation,
  listConsultations,
} from "@/lib/consultationService";
import { requireAuthenticatedSession } from "@/lib/adminSession";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const items = await listConsultations({ date, q });
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
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.consultationDate || !body.startTime || !body.endTime || !body.roomId) {
      return NextResponse.json(
        { success: false, error: "날짜·시간·상담실은 필수입니다." },
        { status: 400 }
      );
    }
    const created = await createConsultation(body);
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "등록 실패" },
      { status: 500 }
    );
  }
}
