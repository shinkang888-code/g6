import { NextRequest, NextResponse } from "next/server";
import { createNotice, listNotices } from "@/lib/noticeService";
import { requireAuthenticatedSession } from "@/lib/adminSession";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("page_size") ?? "50");
    const { items, total } = await listNotices({ q, page, pageSize });
    return NextResponse.json({
      success: true,
      data: items,
      total,
      page,
      pageSize,
    });
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
    if (!body.title?.trim()) {
      return NextResponse.json({ success: false, error: "제목을 입력하세요." }, { status: 400 });
    }
    const created = await createNotice({
      title: body.title,
      content: body.content ?? "",
      authorName: body.authorName ?? "관리자",
      attachments: body.attachments,
    });
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "등록 실패" },
      { status: 500 }
    );
  }
}
