import { buildLawScEmbedUrl } from "@/lib/lawGoKrArticle";

/** 국가법령정보센터 — 조문 검색(임베드·새 창용, lsSc 검색 페이지) */
export function buildLawGoKrArticleUrl(
  lawName: string,
  articleNo: string | number,
  articleSub?: string | number
): string {
  return buildLawScEmbedUrl(lawName, articleNo, articleSub);
}

export function buildLawGoKrLawSearchUrl(lawName: string): string {
  const query = encodeURIComponent(lawName.trim());
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=0&subMenu=1&tabMenuId=81&query=${query}`;
}

export function formatLawArticleLabel(
  lawName: string,
  articleNo: string | number,
  articleSub?: string | number,
  title?: string
): string {
  const jo = articleSub
    ? `${lawName} 제${articleNo}조의${articleSub}`
    : `${lawName} 제${articleNo}조`;
  return title?.trim() ? `${jo} (${title.trim()})` : jo;
}
