/**
 * 프론트엔드 메뉴 조회 (공개)
 * 대시보드 LNB/모바일에서 사용. DB 있으면 DB, 없으면 기본값.
 */

import { NextResponse } from "next/server";
import { getMenusForApp } from "@/lib/menuService";

export async function GET() {
  try {
    const menus = await getMenusForApp();
    return NextResponse.json(menus);
  } catch (e) {
    return NextResponse.json(
      { error: "메뉴를 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
