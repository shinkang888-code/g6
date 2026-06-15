/**
 * 전문 게시판 중간 관리자 API - 게시판 목록
 */

import { NextResponse } from "next/server";
import { isBoardApiConfigured } from "@/lib/boardBridge";
import { listBoards } from "@/lib/boardService";
import { getSession } from "@/lib/authSession";
import { getTenantManagementNumber } from "@/lib/boardApiContext";

export async function GET() {
  try {
    const configured = await isBoardApiConfigured();
    const session = await getSession();
    const mgmt = getTenantManagementNumber(session);

    if (configured) {
      const boards = await listBoards(mgmt);
      return NextResponse.json({
        success: true,
        data: boards.map((b) => ({
          id: b.slug,
          name: b.name,
          description: b.description,
          boardKind: b.boardKind,
          isSystem: b.isSystem,
        })),
        nativeBoard: true,
        g6Connected: false,
      });
    }

    return NextResponse.json({
      success: true,
      data: [],
      nativeBoard: false,
      g6Connected: false,
      hint: "native_boards 마이그레이션을 적용해 주세요.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: "게시판 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
