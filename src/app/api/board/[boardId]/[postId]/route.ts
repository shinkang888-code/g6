/**
 * 전문 게시판 중간 관리자 API - 게시물 단건 조회/수정/삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { bridgeGetPost, bridgeUpdatePost, bridgeDeletePost, isBoardApiConfigured } from "@/lib/boardBridge";
import {
  NOTICE_BOARD_ID,
  getNoticeByNumId,
  incrementNoticeView,
  noticeToBoardPost,
  softDeleteNotice,
  updateNotice,
} from "@/lib/noticeService";
import { requireAuthenticatedSession } from "@/lib/adminSession";

type Params = { params: Promise<{ boardId: string; postId: string }> };

async function useInternalNotices(boardId: string): Promise<boolean> {
  return boardId === NOTICE_BOARD_ID && !(await isBoardApiConfigured());
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { boardId, postId } = await params;
  const id = Number(postId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: "잘못된 게시물 ID입니다." }, { status: 400 });
  }

  if (await useInternalNotices(boardId)) {
    try {
      const item = await getNoticeByNumId(id);
      if (!item) {
        return NextResponse.json({ success: false, error: "공지를 찾을 수 없습니다.", data: null }, { status: 404 });
      }
      await incrementNoticeView(id);
      return NextResponse.json({
        success: true,
        data: noticeToBoardPost({ ...item, viewCount: item.viewCount + 1 }),
        source: "lawygo",
      });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: e instanceof Error ? e.message : "조회 실패" },
        { status: 500 }
      );
    }
  }

  const result = await bridgeGetPost(boardId, id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, data: result.data },
      { status: result.source === "fallback" ? 502 : 404 }
    );
  }
  return NextResponse.json(result);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const { boardId, postId } = await params;
  const id = Number(postId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: "잘못된 게시물 ID입니다." }, { status: 400 });
  }

  let body: { wr_subject?: string; wr_content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (await useInternalNotices(boardId)) {
    try {
      const updated = await updateNotice(id, {
        title: body.wr_subject,
        content: body.wr_content,
      });
      if (!updated) {
        return NextResponse.json({ success: false, error: "공지를 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: noticeToBoardPost(updated),
        source: "lawygo",
      });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: e instanceof Error ? e.message : "수정 실패" },
        { status: 500 }
      );
    }
  }

  const result = await bridgeUpdatePost(boardId, id, body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, data: result.data },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const { boardId, postId } = await params;
  const id = Number(postId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: "잘못된 게시물 ID입니다." }, { status: 400 });
  }

  if (await useInternalNotices(boardId)) {
    try {
      const ok = await softDeleteNotice(id);
      if (!ok) {
        return NextResponse.json({ success: false, error: "공지를 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json({ success: true, source: "lawygo" });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: e instanceof Error ? e.message : "삭제 실패" },
        { status: 500 }
      );
    }
  }

  const result = await bridgeDeletePost(boardId, id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, data: result.data },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
