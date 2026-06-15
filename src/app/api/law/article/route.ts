/**
 * 법령 조문 원문 조회 — Open API 우선, 실패 시 검색 URL(embed) 우회
 * GET ?law=건축법&articleNo=24&articleSub=
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchLawArticleContent } from "@/lib/lawGoKrArticle";
import { getLawGoKrOc } from "@/lib/lawOpenApiSettings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lawName = (searchParams.get("law") ?? "").trim();
  const articleNo = (searchParams.get("articleNo") ?? "").trim();
  const articleSub = (searchParams.get("articleSub") ?? "").trim() || undefined;

  if (!lawName || !articleNo) {
    return NextResponse.json({ error: "law, articleNo가 필요합니다." }, { status: 400 });
  }

  const oc = await getLawGoKrOc();
  const result = await fetchLawArticleContent({ lawName, articleNo, articleSub, oc });

  return NextResponse.json(result);
}
