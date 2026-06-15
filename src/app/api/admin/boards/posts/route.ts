/**
 * 관리자 게시물 목록 (게시판별)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { isNativeBoardReady, listPostsAdmin } from "@/lib/boardService";

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;

  if (!(await isNativeBoardReady())) {
    return NextResponse.json({ error: "native_boards 마이그레이션 필요" }, { status: 503 });
  }

  const boardId = new URL(req.url).searchParams.get("boardId");
  if (!boardId) return NextResponse.json({ error: "boardId 필요" }, { status: 400 });

  const page = Number(new URL(req.url).searchParams.get("page") ?? "1");
  const pageSize = Number(new URL(req.url).searchParams.get("page_size") ?? "50");

  try {
    const { items, total } = await listPostsAdmin(boardId, { page, pageSize });
    return NextResponse.json({ data: items, total, page, pageSize });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 }
    );
  }
}
