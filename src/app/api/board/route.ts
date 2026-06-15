/**
 * 전문 게시판 중간 관리자 API - 게시판 목록
 * GET: LawyGo에서 사용하는 게시판 ID/이름 목록 반환
 */

import { NextResponse } from "next/server";
import { isBoardApiConfigured } from "@/lib/boardBridge";
import { BOARD_LIST } from "@/lib/boardConfig";

export async function GET() {
  try {
    const configured = isBoardApiConfigured();
    return NextResponse.json({
      success: true,
      data: BOARD_LIST,
      g6Connected: configured,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: "게시판 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
