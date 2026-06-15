import { NextRequest, NextResponse } from "next/server";
import {
  getNoticeByNumId,
  incrementNoticeView,
  softDeleteNotice,
  updateNotice,
} from "@/lib/noticeService";
import { requireAuthenticatedSession } from "@/lib/adminSession";

type Params = { params: Promise<{ numId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { numId } = await params;
    const id = Number(numId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "잘못된 ID입니다." }, { status: 400 });
    }
    const item = await getNoticeByNumId(id);
    if (!item) {
      return NextResponse.json({ success: false, error: "공지를 찾을 수 없습니다." }, { status: 404 });
    }
    await incrementNoticeView(id);
    return NextResponse.json({ success: true, data: { ...item, viewCount: item.viewCount + 1 } });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  try {
    const { numId } = await params;
    const id = Number(numId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "잘못된 ID입니다." }, { status: 400 });
    }
    let body: {
      title?: string;
      content?: string;
      authorName?: string;
      attachments?: { name: string; data: string }[];
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
    }
    const updated = await updateNotice(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: "공지를 찾을 수 없습니다." }, { status: 404 });
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
    const { numId } = await params;
    const id = Number(numId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "잘못된 ID입니다." }, { status: 400 });
    }
    const ok = await softDeleteNotice(id);
    if (!ok) {
      return NextResponse.json({ success: false, error: "공지를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 500 }
    );
  }
}
