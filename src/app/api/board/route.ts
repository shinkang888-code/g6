/**
 * 전문 게시판 중간 관리자 API - 게시판 목록
 */

import { NextResponse } from "next/server";
import { getBoardBridgeStatus, isBoardApiConfigured } from "@/lib/boardBridge";
import { listBoards } from "@/lib/boardService";
import { BOARD_LIST } from "@/lib/boardConfig";
import { getSession } from "@/lib/authSession";
import { getTenantManagementNumber } from "@/lib/boardApiContext";

export async function GET() {
  try {
    const status = await getBoardBridgeStatus();
    const session = await getSession();
    const mgmt = getTenantManagementNumber(session);
    const configured = await isBoardApiConfigured();

    if (status.nativeBoard) {
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
        g6Connected: status.g6Connected,
        bridgePrefer: status.prefer,
      });
    }

    if (status.g6Connected) {
      return NextResponse.json({
        success: true,
        data: BOARD_LIST,
        nativeBoard: false,
        g6Connected: true,
        bridgePrefer: status.prefer,
      });
    }

    return NextResponse.json({
      success: true,
      data: configured ? BOARD_LIST : [],
      nativeBoard: false,
      g6Connected: false,
      bridgePrefer: status.prefer,
      hint: "Supabase 게시판 마이그레이션 또는 G6(NEXT_PUBLIC_GNUBOARD_API_URL) 설정이 필요합니다.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: "게시판 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
