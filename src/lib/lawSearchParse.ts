import { formatLawArticleLabel } from "@/lib/lawLinks";

export type LawArticleItem = {
  id: string;
  lawName: string;
  articleNo: string;
  articleSub?: string;
  title: string;
  summary: string;
  label: string;
};

function parseArticleToken(token: string): { articleNo: string; articleSub?: string } | null {
  const m = token.match(/제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/);
  if (!m) return null;
  return { articleNo: m[1], articleSub: m[2] };
}

function pushArticle(
  items: LawArticleItem[],
  seen: Set<string>,
  lawName: string,
  articleNo: string,
  articleSub: string | undefined,
  title: string,
  summary: string
) {
  const key = `${lawName}|${articleNo}|${articleSub ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push({
    id: key,
    lawName: lawName.trim(),
    articleNo,
    articleSub,
    title: title.trim(),
    summary: summary.trim(),
    label: formatLawArticleLabel(lawName, articleNo, articleSub, title),
  });
}

export function parseLawArticlesFromAiText(text: string): LawArticleItem[] {
  const items: LawArticleItem[] = [];
  const seen = new Set<string>();

  const structuredBlocks = text.split(/---ARTICLE---/i).filter((b) => b.trim());
  if (structuredBlocks.length > 1) {
    for (const block of structuredBlocks) {
      const lawName = block.match(/법령명[:\s]*([^\n]+)/i)?.[1]?.trim() ?? "";
      const articleToken = block.match(/조문[:\s]*([^\n]+)/i)?.[1]?.trim() ?? "";
      const title = block.match(/제목[:\s]*([^\n]+)/i)?.[1]?.trim() ?? "";
      const summary = block.match(/요약[:\s]*([^\n]+(?:\n(?!법령명|조문|제목|---ARTICLE)[^\n]+)*)/i)?.[1]?.trim() ?? "";
      const parsed = parseArticleToken(articleToken);
      if (lawName && parsed) {
        pushArticle(items, seen, lawName, parsed.articleNo, parsed.articleSub, title, summary);
      }
    }
    if (items.length > 0) return items;
  }

  const lineRe =
    /(?:^|\n)\s*(?:\d+[.)]\s*)?(?:\*\*)?([가-힣][가-힣\s]*?(?:법|령|규칙|규정|조례))(?:\*\*)?\s*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?(?:\s*[-–:：]\s*([^\n]+))?/gi;

  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text)) !== null) {
    const lawName = match[1]?.trim() ?? "";
    const articleNo = match[2] ?? "";
    const articleSub = match[3];
    const title = match[4]?.trim() ?? "";
    const after = text.slice(match.index + match[0].length);
    const summary =
      after.match(/^\s*[-–:：]?\s*([^\n]+)/)?.[1]?.trim() ??
      after.match(/^\s*\n\s*([^\n]+)/)?.[1]?.trim() ??
      "";
    if (lawName && articleNo) {
      pushArticle(items, seen, lawName, articleNo, articleSub, title, summary);
    }
  }

  return items;
}

export function extractLawSearchIntro(text: string): string {
  const firstArticle = text.search(/---ARTICLE---|(?:^|\n)\s*\d+[.)]\s*[가-힣]+법\s*제\s*\d+\s*조/im);
  if (firstArticle <= 0) return text.trim();
  return text.slice(0, firstArticle).trim();
}
