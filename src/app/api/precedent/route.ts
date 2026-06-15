/**
 * 판례 본문 조회
 * GET ?caseNumber=2021다12345&aiText= (선택, URL 길이 제한 시 sessionStorage 사용)
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchPrecedentContent } from "@/lib/precedentFetch";
import { getLawGoKrOc } from "@/lib/lawOpenApiSettings";
import { normalizePrecedentCaseNumber } from "@/lib/precedentViewerStorage";
import { isValidPrecedentCaseNumber } from "@/lib/precedentLinks";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const caseNumber = normalizePrecedentCaseNumber(searchParams.get("caseNumber") ?? "");
  const aiText = (searchParams.get("aiText") ?? "").trim();

  if (!caseNumber || !isValidPrecedentCaseNumber(caseNumber)) {
    return NextResponse.json({ error: "유효한 판례 사건번호가 필요합니다." }, { status: 400 });
  }

  const oc = await getLawGoKrOc();
  const result = await fetchPrecedentContent({ caseNumber, oc, aiText: aiText || undefined });
  return NextResponse.json(result);
}
