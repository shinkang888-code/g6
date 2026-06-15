/**
 * 전문 게시판 중간 관리자 API - 댓글 목록 / 작성
 */

import { NextRequest, NextResponse } from "next/server";
import { bridgeGetComments, bridgeCreateComment } from "@/lib/boardBridge";
import { requireAuthenticatedSession } from "@/lib/adminSession";

type Params = { params: Promise<{ boardId: string; postId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { boardId, postId } = await params;
  const id = Number(postId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: "잘못된 게시물 ID입니다." }, { status: 400 });
  }

  const result = await bridgeGetComments(boardId, id);
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

  const { boardId, postId } = await params;
  const id = Number(postId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: "잘못된 게시물 ID입니다." }, { status: 400 });
  }

  let body: { co_content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const content = body.co_content ?? "";
  if (!content.trim()) {
    return NextResponse.json({ success: false, error: "댓글 내용을 입력하세요." }, { status: 400 });
  }

  const result = await bridgeCreateComment(boardId, id, content);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, data: result.data },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
