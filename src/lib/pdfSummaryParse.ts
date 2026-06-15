/** AI 요약 결과를 아코디언 섹션별로 파싱 */
export function parseStructuredSummary(
  summary: string,
  sectionTitles: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!summary.trim()) return result;

  for (let i = 0; i < sectionTitles.length; i++) {
    const title = sectionTitles[i];
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextEscaped = sectionTitles
      .slice(i + 1)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    const boundary = nextEscaped
      ? `(?=(?:\\d+[.)]?\\s*)?(?:${nextEscaped})\\s*[\\n:：]|$)`
      : "$";

    const re = new RegExp(
      `(?:\\d+[.)]?\\s*)?${escaped}\\s*[\\n:：]?\\s*([\\s\\S]*?)${boundary}`,
      "i"
    );
    const match = summary.match(re);
    result[title] = match?.[1]?.trim().replace(/^\*+|\*+$/g, "").trim() ?? "";
  }

  return result;
}
