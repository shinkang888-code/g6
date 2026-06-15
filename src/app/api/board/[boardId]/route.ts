/**
 * 전문 게시판 중간 관리자 API - 게시물 목록 / 작성
 * GET: 목록, POST: 게시물 작성
 */

import { NextRequest, NextResponse } from "next/server";
import { bridgeGetPostList, bridgeCreatePost, isBoardApiConfigured } from "@/lib/boardBridge";
import {
  NOTICE_BOARD_ID,
  createNotice,
  listNotices,
  noticeToBoardPost,
} from "@/lib/noticeService";
import { requireAuthenticatedSession } from "@/lib/adminSession";

type Params = { params: Promise<{ boardId: string }> };

async function useInternalNotices(boardId: string): Promise<boolean> {
  return boardId === NOTICE_BOARD_ID && !(await isBoardApiConfigured());
}

export async function GET(request: NextRequest, { params }: Params) {
  const { boardId } = await params;
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const per_page = searchParams.get("per_page");
  const search_keyword = searchParams.get("search_keyword") ?? undefined;
  const search_field = searchParams.get("search_field") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  if (await useInternalNotices(boardId)) {
    try {
      const { items, total } = await listNotices({
        q: search_keyword,
        page: page ? Number(page) : 1,
        pageSize: per_page ? Number(per_page) : 50,
      });
      return NextResponse.json({
        success: true,
        data: items.map(noticeToBoardPost),
        total,
        source: "lawygo",
      });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: e instanceof Error ? e.message : "공지 목록 조회 실패", data: [] },
        { status: 500 }
      );
    }
  }

  const result = await bridgeGetPostList(boardId, {
    page: page ? Number(page) : undefined,
    per_page: per_page ? Number(per_page) : undefined,
    search_keyword,
    search_field,
    category,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, data: result.data },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const { boardId } = await params;
  let body: { wr_subject?: string; wr_content?: string; wr_name?: string; wr_1?: string; wr_2?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (await useInternalNotices(boardId)) {
    try {
      if (!body.wr_subject?.trim()) {
        return NextResponse.json({ success: false, error: "제목을 입력하세요." }, { status: 400 });
      }
      const created = await createNotice({
        title: body.wr_subject,
        content: body.wr_content ?? "",
        authorName: body.wr_name ?? "관리자",
      });
      return NextResponse.json({
        success: true,
        data: noticeToBoardPost(created),
        source: "lawygo",
      });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: e instanceof Error ? e.message : "공지 등록 실패" },
        { status: 500 }
      );
    }
  }

  const result = await bridgeCreatePost(boardId, {
    wr_subject: body.wr_subject ?? "",
    wr_content: body.wr_content ?? "",
    wr_name: body.wr_name,
    wr_1: body.wr_1,
    wr_2: body.wr_2,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, data: result.data },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
